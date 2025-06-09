'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Bot, User, Play, ArrowDownCircle, Edit, Loader2, Check, FileText, Ban } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { format, parseISO, addHours } from 'date-fns';
import SqlResultPanel from '@/components/SqlResultPanel';
import ResizableSplitter from '@/components/ResizableSplitter';

interface SharedMessage {
  id: number;
  content: string;
  sender: 'user' | 'system';
  timestamp: string;
  sql?: string;
  result?: any;
  error?: boolean;
  connectionId?: string;
}

export default function SharedMessagePage({ params }: { params: { token: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [message, setMessage] = useState<SharedMessage | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editedSql, setEditedSql] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingSqlId, setEditingSqlId] = useState<number | null>(null);
  const [copySuccessId, setCopySuccessId] = useState<number | null>(null);
  const [loadingOperation, setLoadingOperation] = useState<{ type: string | null, messageId: number | null }>({ 
    type: null, 
    messageId: null 
  });
  
  // State for SQL result panel
  const [showResultPanel, setShowResultPanel] = useState(false);
  const [activeQueryResult, setActiveQueryResult] = useState<{
    result: any;
    hasError: boolean;
  } | null>(null);
  
  // Panel splitting state
  const [panelSplit, setPanelSplit] = useState(50); // Default to 50% split
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [stopStreaming, setStopStreaming] = useState(false);
  const stopStreamingRef = useRef(false);

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        const response = await fetch(`/api/messages/shared/${params.token}`);
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        setMessage(data.message);
        setCanEdit(data.canEdit);
        setEditedSql(data.message.content.replace(
          /```sql[\s\S]*?```/,
          data.message.content.match(/```sql[\s\S]*?```/)![0]
        ));
      } catch (error) {
        console.error('Error fetching shared message:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessage();
  }, [params.token]);

  const handleSqlSave = async () => {
    if (!message || !editedSql) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/messages/shared/${params.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: message.content.replace(
            /```sql[\s\S]*?```/,
            `\`\`\`sql\n${editedSql}\n\`\`\``
          )
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      setMessage(prev => prev ? { 
        ...prev, 
        content: prev.content.replace(
          /```sql[\s\S]*?```/,
          `\`\`\`sql\n${editedSql}\n\`\`\``
        )
      } : null);
      setEditingSqlId(null);
    } catch (error) {
      console.error('Error saving SQL:', error);
      toast({
        title: "Error",
        description: "Failed to save SQL changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text: string, messageId: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccessId(messageId);
      setTimeout(() => setCopySuccessId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleExplain = async (sql: string) => {
    if (!message?.connectionId) {
      toast({
        title: "Error",
        description: "No database connection available",
        variant: "destructive",
      });
      return;
    }

    setLoadingOperation({ type: 'explain', messageId: message?.id || null });
    setIsStreaming(true);
    setStopStreaming(false);
    stopStreamingRef.current = false;
    
    try {
      const response = await fetch('/api/run-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sql: `EXPLAIN ${sql}`,
          connectionId: message.connectionId
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to explain query');
      }

      // Streaming response handling
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = "";
        let rows: any[] = [];

        while (!done) {
          if (stopStreamingRef.current) {
            reader.cancel();
            break;
          }
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            let lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.trim()) {
                const row = JSON.parse(line);
                rows.push(row);
                setMessage(prev => prev ? { ...prev, result: [...rows] } : null);
                
                // Also update the active query result for the panel
                setActiveQueryResult({
                  result: [...rows],
                  hasError: false
                });
                if (!showResultPanel) {
                  setShowResultPanel(true);
                }
              }
            }
          }
          if (done) {
            break;
          }
        }
        
        // Handle any remaining buffered line
        if (buffer.trim()) {
          const row = JSON.parse(buffer);
          rows.push(row);
          setMessage(prev => prev ? { ...prev, result: [...rows] } : null);
          
          // Update the panel result one last time
          setActiveQueryResult({
            result: [...rows],
            hasError: false
          });
          setShowResultPanel(true);
        }
      } else {
        // fallback for non-streaming
        const data = await response.json();
        setMessage(prev => prev ? { ...prev, result: data.result } : null);
        
        // Show result in panel
        setActiveQueryResult({
          result: data.result,
          hasError: false
        });
        setShowResultPanel(true);
      }
    } catch (error) {
      console.error('Error explaining query:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to explain query",
        variant: "destructive",
      });
      
      // Show error in panel
      setActiveQueryResult({
        result: [{ error: error instanceof Error ? error.message : "Failed to explain query" }],
        hasError: true
      });
      setShowResultPanel(true);
    } finally {
      setLoadingOperation({ type: null, messageId: null });
      setIsStreaming(false);
      setStopStreaming(false);
      stopStreamingRef.current = false;
    }
  };

  const handleRunSql = async (sql: string) => {
    if (!message?.connectionId) {
      toast({
        title: "Error",
        description: "No database connection available",
        variant: "destructive",
      });
      return;
    }

    setLoadingOperation({ type: 'run', messageId: message?.id || null });
    setIsStreaming(true);
    setStopStreaming(false);
    stopStreamingRef.current = false;
    
    try {
      const response = await fetch('/api/run-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sql,
          connectionId: message.connectionId
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to run query');
      }

      // Streaming response handling
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = "";
        let rows: any[] = [];

        while (!done) {
          if (stopStreamingRef.current) {
            reader.cancel();
            break;
          }
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            let lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.trim()) {
                const row = JSON.parse(line);
                rows.push(row);
                setMessage(prev => prev ? { ...prev, result: [...rows] } : null);
                
                // Also update the active query result for the panel
                setActiveQueryResult({
                  result: [...rows],
                  hasError: false
                });
                if (!showResultPanel) {
                  setShowResultPanel(true);
                }
              }
            }
          }
          if (done) {
            break;
          }
        }
        
        // Handle any remaining buffered line
        if (buffer.trim()) {
          const row = JSON.parse(buffer);
          rows.push(row);
          setMessage(prev => prev ? { ...prev, result: [...rows] } : null);
          
          // Update the panel result one last time
          setActiveQueryResult({
            result: [...rows],
            hasError: false
          });
          setShowResultPanel(true);
        }
      } else {
        // fallback for non-streaming
        const data = await response.json();
        setMessage(prev => prev ? { ...prev, result: data.result } : null);
        
        // Show result in panel
        setActiveQueryResult({
          result: data.result,
          hasError: false
        });
        setShowResultPanel(true);
      }
    } catch (error) {
      console.error('Error running query:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run query",
        variant: "destructive",
      });
      
      // Show error in panel
      setActiveQueryResult({
        result: [{ error: error instanceof Error ? error.message : "Failed to run query" }],
        hasError: true
      });
      setShowResultPanel(true);
    } finally {
      setLoadingOperation({ type: null, messageId: null });
      setIsStreaming(false);
      setStopStreaming(false);
      stopStreamingRef.current = false;
    }
  };

  const formatJapanTime = (timestamp: string) => {
    // Convert UTC time to JST (UTC+9)
    const date = parseISO(timestamp);
    const jstDate = addHours(date, 9);
    return format(jstDate, 'yyyy/MM/dd HH:mm:ss');
  };

  // Function to close the result panel
  const closeResultPanel = () => {
    setShowResultPanel(false);
    setActiveQueryResult(null);
  };

  // Function to view result in panel
  const viewResultInPanel = (result: any, hasError: boolean) => {
    setActiveQueryResult({
      result,
      hasError
    });
    setShowResultPanel(true);
  };
  
  // Function to handle resizing between chat and SQL panels
  const handlePanelResize = (newPosition: number) => {
    setPanelSplit(newPosition);
    // Save preference to localStorage for persistence
    localStorage.setItem('sharedPanelSplitPosition', newPosition.toString());
  };
  
  // Load saved panel split preference on mount
  useEffect(() => {
    const savedSplit = localStorage.getItem('sharedPanelSplitPosition');
    if (savedSplit) {
      setPanelSplit(parseFloat(savedSplit));
    }
  }, []);

  const renderContent = (content: string) => {
    const parts = content.split(/(```sql[\s\S]*?```)/);
    
    return parts.map((part, index) => {
      if (part.startsWith('```sql')) {
        const sql = part.replace('```sql', '').replace('```', '').trim();
        const isEditing = editingSqlId === message?.id;

        return (
          <div key={index} className="my-3 bg-blue-100 text-blue-900 p-3 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <p className="font-semibold">Generated SQL:</p>
              <div className="flex gap-2">
                {!isEditing && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(sql, message?.id || 0)}
                          >
                            {copySuccessId === message?.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-blue-600" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{copySuccessId === message?.id ? 'Copied!' : 'Copy SQL'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {session && (
                      <>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleExplain(sql)}
                                disabled={loadingOperation.type === 'explain' && loadingOperation.messageId === message?.id}
                              >
                                {loadingOperation.type === 'explain' && loadingOperation.messageId === message?.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileText className="h-4 w-4 text-blue-600" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Explain Query</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRunSql(sql)}
                                disabled={loadingOperation.type === 'run' && loadingOperation.messageId === message?.id}
                              >
                                {loadingOperation.type === 'run' && loadingOperation.messageId === message?.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 text-blue-600" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Run SQL</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </>
                    )}
                    {canEdit && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingSqlId(message?.id || null);
                                setEditedSql(sql);
                              }}
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit SQL</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </>
                )}
              </div>
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedSql}
                  onChange={(e) => setEditedSql(e.target.value)}
                  className="min-h-[100px] font-mono bg-white border border-blue-200"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditingSqlId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSqlSave}
                    disabled={isSaving || editedSql === sql}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <pre className="bg-gray-800 text-gray-100 p-2 rounded-md overflow-x-auto font-mono text-sm whitespace-pre-wrap">{sql}</pre>
            )}
          </div>
        );
      }
      // Handle regular text with markdown support
      return part.trim() ? (
        <div key={index} className="prose dark:prose-invert max-w-none">
          <ReactMarkdown>{part}</ReactMarkdown>
        </div>
      ) : null;
    });
  };

  const renderResult = () => {
    if (!message?.result) return null;

    if (message.error) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{message.result.error}</AlertDescription>
        </Alert>
      );
    }

    if (Array.isArray(message.result)) {
      if (message.result.length === 0) {
        return (
          <Alert>
            <AlertTitle>No Results</AlertTitle>
            <AlertDescription>
              The query returned no results.
            </AlertDescription>
          </Alert>
        );
      }
    }

    if ("affectedRows" in message.result) {
      return (
        <Alert>
          <AlertTitle>Query Executed Successfully</AlertTitle>
          <AlertDescription>
            Affected rows: {message.result.affectedRows}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-4">Message Not Found</h1>
            <p className="text-gray-600">The shared message could not be found or has been deleted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const messageClass = message.sender === 'user' 
    ? 'bg-blue-100 text-blue-900' 
    : 'bg-gray-100 text-gray-900';

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-center">
        <div className="w-full max-w-6xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Shared Message</h1>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Shared on {formatJapanTime(message.timestamp)}</p>
              {canEdit && (
                <p className="text-green-600">You have permission to run, explain and edit this message</p>
              )}
              {(!session && process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true') && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <p className="text-blue-600">Sign in to run and explain and Edit SQL queries</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signIn()}
                    className="ml-2"
                  >
                    Sign In
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Resizable container for message and SQL panels */}
          <div id="resizable-container" className="flex h-[calc(100vh-200px)] overflow-hidden">
            {/* Message panel */}
            <div 
              style={{ 
                width: showResultPanel ? `${panelSplit}%` : '100%',
                minWidth: showResultPanel ? '20%' : '100%',
                maxWidth: showResultPanel ? '80%' : '100%',
                transition: showResultPanel ? 'none' : 'width 0.2s ease-in-out'
              }}
              className="h-full"
            >
              <div className="bg-white rounded-lg shadow-lg p-6 h-full overflow-auto">
                <div className="flex items-start space-x-4">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback
                      className={
                        message.sender === "user" ? "bg-blue-100" : "bg-gray-300"
                      }
                    >
                      {message.sender === "user" ? (
                        <User className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Bot className="w-5 h-5 text-gray-600" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    {message.error ? (
                      <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{message.content}</AlertDescription>
                      </Alert>
                    ) : (
                      <div className="prose dark:prose-invert max-w-none">
                        {renderContent(message.content)}
                      </div>
                    )}
                    {message.result && (
                      <div className="mt-4 bg-white rounded-md shadow-inner overflow-x-auto">
                        {renderResult()}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {formatJapanTime(message.timestamp)}
                    </p>
                    
                    {isStreaming && (
                      <div className="mt-4 text-right">
                        <Button
                          onClick={() => {
                            setStopStreaming(true);
                            stopStreamingRef.current = true;
                          }}
                          variant="destructive"
                          size="sm"
                          className="mt-2"
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Stop Streaming
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Resizable splitter - only shown when SQL result panel is active */}
            {showResultPanel && (
              <ResizableSplitter
                onResize={handlePanelResize}
                initialPosition={panelSplit}
                minLeftWidth={20}
                minRightWidth={20}
                className="h-full flex-shrink-0"
              />
            )}

            {/* SQL Result panel */}
            {showResultPanel && (
              <div 
                style={{ 
                  width: `${100 - panelSplit}%`,
                  minWidth: '20%',
                  maxWidth: '80%',
                  transition: 'none'
                }}
                className="h-full flex-shrink-0"
              >
                <SqlResultPanel 
                  results={activeQueryResult?.result} 
                  hasError={activeQueryResult?.hasError || false}
                  onClose={closeResultPanel} 
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 