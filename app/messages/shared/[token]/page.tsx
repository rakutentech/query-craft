'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, User, Bot, Share2, Play, Copy, Edit, FileText, Check } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';

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
  const [loadingOperation, setLoadingOperation] = useState<{ type: 'explain' | 'run' | null; messageId: number | null }>({ type: null, messageId: null });

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

      const data = await response.json();
      setMessage(prev => prev ? { ...prev, result: data.result } : null);
    } catch (error) {
      console.error('Error explaining query:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to explain query",
        variant: "destructive",
      });
    } finally {
      setLoadingOperation({ type: null, messageId: null });
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

      const data = await response.json();
      setMessage(prev => prev ? { ...prev, result: data.result } : null);
    } catch (error) {
      console.error('Error running query:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run query",
        variant: "destructive",
      });
    } finally {
      setLoadingOperation({ type: null, messageId: null });
    }
  };

  const formatJapanTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(```sql[\s\S]*?```)/);
    
    return parts.map((part, index) => {
      if (part.startsWith('```sql')) {
        const sql = part.replace('```sql', '').replace('```', '').trim();
        const isEditing = editingSqlId === message?.id;

        return (
          <div key={index} className="my-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold text-blue-800">Generated SQL:</p>
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
              <pre className="bg-white p-4 rounded-md overflow-x-auto font-mono text-sm text-blue-900 border border-blue-200">{sql}</pre>
            )}
          </div>
        );
      }
      return <p key={index} className="text-gray-700">{part}</p>;
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
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {Object.keys(message.result[0] || {}).map((key) => (
                  <th
                    key={key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {message.result.map((row, index) => (
                <tr key={index}>
                  {Object.values(row).map((value, i) => (
                    <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
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

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-start space-x-4">
              <Avatar className="w-10 h-10">
                <AvatarFallback
                  className={
                    message.sender === "user" ? "bg-blue-100" : "bg-gray-300"
                  }
                >
                  {message.sender === "user" ? (
                    <User className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Bot className="w-6 h-6 text-gray-600" />
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
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    {renderResult()}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {formatJapanTime(message.timestamp)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 