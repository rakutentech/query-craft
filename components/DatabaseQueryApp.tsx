"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  ClipboardCopy,
  Info,
  Play,
  Search,
  Bot,
  User,
  Send,
  Database,
  RotateCcw,
  Check,
  Pencil,
  Loader2
} from "lucide-react";
import { format, parseISO, addHours } from "date-fns";
import ReactMarkdown from 'react-markdown';
import { Textarea } from "@/components/ui/textarea";
const BASE_PATH =  process.env.NEXT_PUBLIC_BASE_PATH;

interface QueryResult {
  [key: string]: any;
}

interface QueryResponse {
  error?: string;
  affectedRows?: number;
}

interface Message {
  id: number;
  content: string;
  sender: "user" | "system";
  timestamp: string;
  sql?: string;
  result?: QueryResult[] | QueryResponse;
  error?: boolean;
  editedSql?: string;
}

interface DatabaseConnection {
  id: number;
  projectName: string;
  dbDriver: string;
}

interface Conversation {
  id: number;
  title: string;
  connectionId: number;
  timestamp: string;
}


export default function DatabaseQueryApp() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation[]>([]); 
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSql, setPendingSql] = useState<{
    sql: string;
    messageId: number;
  } | null>(null);
  const [databaseConnections, setDatabaseConnections] = useState<
    DatabaseConnection[]
  >([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    number | null
  >(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [editingSqlId, setEditingSqlId] = useState<number | null>(null);
  const [copySuccessId, setCopySuccessId] = useState<number | null>(null);
  //  different state from send button loading operation, so that support multiple operations at the same time
  const [loadingOperation, setLoadingOperation] = useState<{ type: 'explain' | 'run' | null; messageId: number | null }>({ type: null, messageId: null });
  const conversationsCache = useRef<Map<number, Conversation[]>>(new Map());

  useEffect(() => {
    checkSettings();
    fetchDatabaseConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedConnectionId !== null) {
      fetchConversationsByConnection(selectedConnectionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnectionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const checkSettings = async () => {
    try {
      const response = await fetch(`${BASE_PATH}/api/settings`);
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const settings = await response.json();
      if (!settings || settings.databaseConnections.length === 0) {
        router.push("/settings");
      }
    } catch (error) {
      console.error("Error checking settings:", error);
      router.push("/settings");
    }
  };

  const fetchDatabaseConnections = async () => {
    try {
      const response = await fetch(`${BASE_PATH}/api/settings`);
      if (!response.ok) {
        throw new Error("Failed to fetch database connections");
      }
      const data = await response.json();
      setDatabaseConnections(data.databaseConnections);
      if (data.databaseConnections.length > 0) {
        setSelectedConnectionId(data.databaseConnections[0].id);
      }
    } catch (error) {
      console.error("Error fetching database connections:", error);
    }
  };

  const fetchConversationsByConnection = async (connectionId: number) => {
    // Check cache first
    if (conversationsCache.current.has(connectionId)) {
      setCurrentConversation(conversationsCache.current.get(connectionId)!);
      return;
    }

    try {
      const response = await fetch(`${BASE_PATH}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connectionId }),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }
      const data = await response.json();
      const conversations = data.conversations;
      
      // Update cache
      conversationsCache.current.set(connectionId, conversations);
      setCurrentConversation(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  const handleConnectionSelect = (connectionId: number) => {
    setSelectedConnectionId(connectionId);
    setConversationId(null);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConnectionId) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_PATH}/api/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: inputMessage,
          conversationId,
          connectionId: selectedConnectionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setConversationId(data.conversationId);

      const newMessages = data.conversationHistory.map((msg: Message) => {
        if (msg.sender === "system" && msg.content.startsWith("```sql")) {
          let sql = msg.content
            .replace("```sql", "")
            .replace("```", "")
            .trim();
          if (sql === "") {
             sql = "Knowledge insufficient, please provide more information."
          }
          return { ...msg, sql };
        }
        return msg;
      });

      setMessages(newMessages);

      if (!conversationId && selectedConnectionId !== null) {
        const newConversation = {
          id: data.conversationId,
          connectionId: selectedConnectionId,
          title: inputMessage.substring(0, 50) + "...",
          timestamp: new Date().toISOString(),
        };
        
        // Update cache
        const currentConversations = conversationsCache.current.get(selectedConnectionId) || [];
        conversationsCache.current.set(selectedConnectionId, [newConversation, ...currentConversations]);
        setCurrentConversation([newConversation, ...currentConversations]);
      }
    } catch (error) {
      console.error("Error executing query:", error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        content:
          error instanceof Error ? error.message : "An unknown error occurred.",
        sender: "system",
        timestamp: formatJapanTime(new Date().toISOString()),
        error: true
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setInputMessage("");
      setIsLoading(false);
    }
  };

  const checkForSideEffects = (sql: string): boolean => {
    const sideEffectKeywords = [
      "UPDATE",
      "DELETE",
      "INSERT",
      "DROP",
      "ALTER",
      "TRUNCATE"
    ];
    const upperCaseSql = sql.toUpperCase();
    // match keyward+space to avoid false positives
    return sideEffectKeywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(upperCaseSql));
  };

  const runSQL = async (sql: string, messageId: number) => {
    if (checkForSideEffects(sql)) {
      setPendingSql({ sql, messageId });
      setShowConfirmDialog(true);
    } else {
      setLoadingOperation({ type: 'run', messageId });
      await executeSql(sql, messageId);
      setLoadingOperation({ type: null, messageId: null });
    }
  };

  const explainSQL = async (sql: string, messageId: number) => {
    setLoadingOperation({ type: 'explain', messageId });
    const explainSql = `EXPLAIN ${sql}`;
    await executeSql(explainSql, messageId);
    setLoadingOperation({ type: null, messageId: null });
  };

  const executeSql = async (sql: string, messageId: number) => {
    if (!selectedConnectionId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                error: true,
                result: [{ error: "No database connection selected" }]
              }
            : msg
        )
      );
      return;
    }

    try {
      const response = await fetch(`${BASE_PATH}/api/run-sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sql, connectionId: selectedConnectionId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details?.sqlMessage ||
            data.message ||
            "An error occurred while executing the SQL query."
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, result: data.result } : msg
        )
      );
    } catch (error) {
      console.error("Error running SQL:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to run SQL query";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, error: true, result: [{ error: errorMessage }] }
            : msg
        )
      );
    }
  };

  const handleConfirmExecution = () => {
    if (pendingSql) {
      executeSql(pendingSql.sql, pendingSql.messageId);
    }
    setShowConfirmDialog(false);
    setPendingSql(null);
  };

  const handleCancelExecution = () => {
    setShowConfirmDialog(false);
    setPendingSql(null);
  };

  const handleConversationClick = async (conversation: Conversation) => {
    setConversationId(conversation.id);
    try {
      const response = await fetch(
        `${BASE_PATH}/api/conversations/${conversation.id}?connectionId=${selectedConnectionId}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch conversation");
      }
      const data = await response.json();

      const updatedMessages = data.messages.map((msg: Message) => {
        if (msg.sender === "system" && msg.content.startsWith("```sql")) {
          let sqlContent = msg.content
            .replace("```sql", "")
            .replace("```", "")
            .trim();
          if (sqlContent === "") {
            sqlContent = "Knowledge insufficient, please provide more information."
          }
          return { ...msg, sql: sqlContent };
        }
        return msg;
      });

      setMessages(updatedMessages);
    } catch (error) {
      console.error("Error fetching conversation:", error);
    }
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setInputMessage("");
  };

  const formatJapanTime = (timestamp: string) => {
    const date = parseISO(timestamp);
    const japanTime = addHours(date, 9); // Add 9 hours to get Japan time
    return format(japanTime, "yyyy-MM-dd HH:mm:ss");
  };

  const copyToClipboard = (text: string, messageId: number) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopySuccessId(messageId);
        setTimeout(() => {
          setCopySuccessId(null);
        }, 2000);
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
  };

  const handleSqlEdit = (messageId: number, sql: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, editedSql: sql } : msg
    ));
  };

  const handleSqlSave = (messageId: number) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, sql: msg.editedSql } : msg
    ));
    setEditingSqlId(null);
  };

  const renderMessage = (message: Message) => {
    const isError = message.error;

    const renderContent = (content: string) => {
      const parts = content.split(/(```sql[\s\S]*?```)/);
      
      return parts.map((part, index) => {
        if (part.startsWith('```sql')) {
          const sql = part.replace('```sql', '').replace('```', '').trim();
          const messageId = message.id;
          const isEditing = editingSqlId === messageId;
          const currentSql = message.editedSql || sql;

          return (
            <div key={index} className="my-3 bg-blue-100 text-blue-900 p-3 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold">Generated SQL:</p>
                <div className="flex gap-2">
                  {!isEditing && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(currentSql, messageId)}
                          >
                            {copySuccessId === messageId ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <ClipboardCopy className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{copySuccessId === messageId ? 'Copied!' : 'Copy SQL'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => isEditing ? handleSqlSave(messageId) : setEditingSqlId(messageId)}
                        >
                          {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isEditing ? 'Save' : 'Edit'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              {isEditing ? (
                <Textarea
                  value={currentSql}
                  onChange={(e) => handleSqlEdit(messageId, e.target.value)}
                  className="font-mono bg-gray-800 text-gray-100 p-2 rounded-md w-full min-h-[100px]"
                />
              ) : (
                <pre className="bg-gray-800 text-gray-100 p-2 rounded-md overflow-x-auto">
                  <code>{currentSql}</code>
                </pre>
              )}
              <div className="mt-3 space-x-2">
                <Button
                  onClick={() => explainSQL(currentSql, messageId)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={loadingOperation.type === 'explain' && loadingOperation.messageId === messageId}
                >
                  {loadingOperation.type === 'explain' && loadingOperation.messageId === messageId ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  Explain
                </Button>
                <Button
                  onClick={() => runSQL(currentSql, messageId)}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={loadingOperation.type === 'run' && loadingOperation.messageId === messageId}
                >
                  {loadingOperation.type === 'run' && loadingOperation.messageId === messageId ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Run SQL
                </Button>
                {isEditing && (
                  <Button
                    onClick={() => {
                      handleSqlEdit(messageId, sql);
                      setEditingSqlId(null);
                    }}
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-600"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          );
        } else {
          // Handle regular text with markdown support
          return part.trim() ? (
            <div key={index} className="prose dark:prose-invert max-w-none">
              <ReactMarkdown>{part}</ReactMarkdown>
            </div>
          ) : null;
        }
      });
    };

    const messageClass = isError
      ? "bg-red-100 text-red-900"
      : message.sender === "user"
      ? "bg-blue-50 text-gray-800"
      : "bg-gray-100 text-gray-800";

    const renderResult = () => {
      if (!message.result) return null;

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
        return (
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                {Object.keys(message.result[0]).map((key) => (
                  <th
                    key={key}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {message.result.map((row, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {Object.values(row).map((value, idx) => (
                    <td
                      key={idx}
                      className="px-4 py-2 whitespace-nowrap text-sm text-gray-900"
                    >
                      {String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      } else if ("affectedRows" in message.result) {
        return (
          <Alert>
            <AlertTitle>Query Executed Successfully</AlertTitle>
            <AlertDescription>
              Affected rows: {message.result.affectedRows}
            </AlertDescription>
          </Alert>
        );
      } else {
        return (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{message.result.error}</AlertDescription>
          </Alert>
        );
      }
    };

    return (
      <div
        key={message.id}
        className={`flex ${
          message.sender === "user" ? "justify-end" : "justify-start"
        } mb-4`}
      >
        <div
          className={`flex items-start space-x-2 ${
            message.sender === "user" ? "flex-row-reverse space-x-reverse" : ""
          }`}
        >
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
          <div className={`rounded-lg p-3 ${messageClass} max-w-[600px] shadow-md`}>
            {isError ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{message.content}</AlertDescription>
              </Alert>
            ) : (
              renderContent(message.content)
            )}
            {message.result && (
              <div className="mt-3 bg-white rounded-md shadow-inner overflow-x-auto">
                {renderResult()}
              </div>
            )}
            <p className="text-xs mt-2 opacity-70">
              {formatJapanTime(message.timestamp)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="container mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">QueryCraft Chat</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAbout(!showAbout)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>About QueryCraft</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {showAbout && (
          <Card className="mb-6">
            <CardHeader>About QueryCraft</CardHeader>
            <CardContent>
              <p>
                QueryCraft is an AI-powered tool that helps you generate and
                execute SQL queries using natural language. Simply type your
                question, and QueryCraft will generate the appropriate SQL query
                and run it against your database. It&apos;s designed to make database
                querying more accessible and efficient for both beginners and
                experienced users.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex space-x-6">
          <div className="w-1/4 min-w-[250px]">
            <Card className="mb-6">
              <CardHeader>Database Connections</CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <ul className="space-y-2">
                    {databaseConnections.map((connection) => (
                      <li key={connection.id}>
                        <Button
                          variant={
                            selectedConnectionId === connection.id
                              ? "default"
                              : "outline"
                          }
                          className="w-full justify-start"
                          onClick={() => handleConnectionSelect(connection.id)}
                        >
                          <Database className="mr-2 h-4 w-4" />
                          {connection.projectName}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="h-[calc(100vh-420px)] bg-white shadow-lg">
              <CardHeader className="border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-800">
                    History
                  </h2>
                  <Button
                    onClick={handleNewConversation}
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    New Chat
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(99vh-500px)] overflow-y-auto">
                  <ul className="divide-y divide-gray-200">
                    {selectedConnectionId &&
                      currentConversation?.map(
                        (conversation) => (
                          <li
                            key={conversation.id}
                            className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors duration-150 ${
                              conversation.id === conversationId
                                ? "bg-blue-100"
                                : ""
                            }`}
                            onClick={() =>
                              handleConversationClick(conversation)
                            }
                          >
                            <p className="font-medium text-gray-800 truncate">
                              {conversation.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatJapanTime(conversation.timestamp)}
                            </p>
                          </li>
                        )
                      )}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="flex-1 flex flex-col h-[calc(100vh-120px)]">
            <Card className="flex-1 flex flex-col bg-white shadow-lg">
              <CardContent className="flex-1 overflow-hidden p-4">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 h-[calc(80vh-65px)]">
                    {messages.map(renderMessage)}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
              <CardContent className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex space-x-2">
                  <Textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your query..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 min-h-[60px] max-h-[200px] resize-y"
                    disabled={!selectedConnectionId}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading || !selectedConnectionId}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send
                  </Button>
                </div>
                {!selectedConnectionId && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTitle>No database selected</AlertTitle>
                    <AlertDescription>
                      Please select a database connection to start querying.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm SQL Execution</AlertDialogTitle>
            <AlertDialogDescription>
              This SQL query may modify the database. Are you sure you want to
              proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExecution}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExecution}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
