"use client";

import React, {useState, useEffect, useRef, useContext} from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@radix-ui/themes";
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
  Loader2,
  Share2,
  Ban,
  ArrowDown,
  X,
  ChevronLeft,
  ChevronRight,
  Code
} from "lucide-react";
import { format, parseISO, addHours } from "date-fns";
import ReactMarkdown from 'react-markdown';
import { Textarea } from "@/components/ui/textarea";
import { useSession, signIn, signOut } from 'next-auth/react';
import { UnauthorizedAccess } from "@/components/UnauthorizedAccess";
import {
  useChatProviderConfig
} from "@/app/context/ChatProviderConfigContext";
import { useToast } from "@/components/ui/use-toast";
import Image from "next/image";
import {AI_PROVIDER_ERROR} from "@/constants/error";
import { Box, Flex, Text } from "@radix-ui/themes";
import SqlResultPanel from './SqlResultPanel';
import ResizableSplitter from './ResizableSplitter';
import { TagCloud } from "@/components/ui/tag-cloud";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { NoDatabaseAlert } from "./NoDatabaseAlert";
import { DatabaseSidebar } from "./DatabaseSidebar";
import { HistorySidebar } from "./HistorySidebar";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";

const BASE_PATH =  process.env.NEXT_PUBLIC_BASE_PATH;
const ENABLE_OAUTH = process.env.NEXT_PUBLIC_ENABLE_OAUTH;


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
  id?: number;
  projectName: string;
  dbDriver: string;
  dbHost: string;
  dbPort: string;
  dbUsername: string;
  dbPassword: string;
  dbName: string;
  schema: string;
  tag?: string;
}
interface Conversation {
  id: number;
  title: string;
  connectionId: number;
  timestamp: string;
}


export default function DatabaseQueryApp() {
  const { data: session, status } = useSession();
  const [currentConversation, setCurrentConversation] = useState<Conversation[]>([]); 
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
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
  const [selectedTag, setSelectedTag] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedDatabaseTag') || null;
    }
    return null;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [editingSqlId, setEditingSqlId] = useState<number | null>(null);
  const [copySuccessId, setCopySuccessId] = useState<number | null>(null);
  //  different state from send button loading operation, so that support multiple operations at the same time
  const [loadingOperation, setLoadingOperation] = useState<{ type: 'explain' | 'run' | null; messageId: number | null }>({ type: null, messageId: null });
  const conversationsCache = useRef<Map<number, Conversation[]>>(new Map());
  const [showAuth, setShowAuth] = useState(false);
  const { providerConfig} = useChatProviderConfig();
  const { toast } = useToast();
  const [stopStreaming, setStopStreaming] = useState(false);
  const stopStreamingRef = useRef(false);
  const prevMessagesRef = useRef<Message[]>([]);
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [activeQueryResult, setActiveQueryResult] = useState<{
    result: QueryResult[] | QueryResponse | undefined;
    hasError: boolean;
  } | null>(null);
  const [showResultPanel, setShowResultPanel] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [screenSize, setScreenSize] = useState({
    isLarge: false,  // >= 1280px (xl breakpoint)
    isMedium: false  // >= 768px (md breakpoint)
  });
  const [panelSplit, setPanelSplit] = useState<number>(50); // Default 50% split

  const [listOfDBTables, setListOfDBTables] = useState<string[]>([]);

  const [appLoading, setAppLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const recommendationsRef = useRef<HTMLDivElement>(null);

  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [embedCode, setEmbedCode] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    // Try to load cached databaseConnections for instant display
    const cached = localStorage.getItem('dbConnectionsCache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setDatabaseConnections(parsed);
        setAppLoading(false);
      } catch (err) {
        console.error('Error parsing dbConnectionsCache:', err);
        // Do not interrupt the app, just continue
      }
    }
    const load = async () => {
      try {
        await checkSettings();
        await fetchDatabaseConnections();
      } finally {
        if (isMounted) setAppLoading(false);
      }
    };
    load();
    setShowAuth(ENABLE_OAUTH === 'true');
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedConnectionId !== null) {
      fetchConversationsByConnection(selectedConnectionId);
      fetchListOfDBTables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnectionId]);

  useEffect(() => {
    // Helper to strip result from messages for comparison
    const stripResult = (msgs: Message[]) =>
        msgs.map(({ result, ...rest }) => rest);

    const prevStripped = JSON.stringify(stripResult(prevMessagesRef.current));
    const currStripped = JSON.stringify(stripResult(messages));

    if (prevStripped !== currStripped) {
      scrollToBottom();
    }

    prevMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (selectedTag) {
      localStorage.setItem('selectedDatabaseTag', selectedTag);
    } else {
      localStorage.removeItem('selectedDatabaseTag');
    }
  }, [selectedTag]);

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
      localStorage.setItem('dbConnectionsCache', JSON.stringify(data.databaseConnections));
      if (data.databaseConnections.length > 0) {
        setSelectedConnectionId(data.databaseConnections[0].id);
      }
    } catch (error) {
      console.error("Error fetching database connections:", error);
    }
  };

  const fetchListOfDBTables = async () => {
    try {
      const response = await fetch(`${BASE_PATH}/api/db-tables/${selectedConnectionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch database tables");
      }
      const data = await response.json();
      setListOfDBTables(data);
    } catch (error) {
      console.error("Error fetching database tables:", error);
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

  const handleConnectionSelect = (connectionId: number | undefined) => {
    if (!connectionId) {
      return;
    }
    setSelectedConnectionId(connectionId);
    setConversationId(null);
    setMessages([]);
  };

  const handleStopStreaming = async () => {
    setStopStreaming(true);
    stopStreamingRef.current = true;
    if (conversationId) {
      await fetch(`${BASE_PATH}/api/query`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId })
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConnectionId) return;

    setInputMessage(""); // Clear input immediately

    // Optimistically add user's message to chat area
    const tempMessage: Message = {
      id: Date.now(),
      content: inputMessage,
      sender: "user",
      timestamp: formatJapanTime(new Date().toISOString()),
    };
    setMessages((prev) => [...prev, tempMessage]);

    setIsLoading(true);
    let metaReceived = false;
    let meta: { conversationId: number; conversationHistory: any } | null = null;
    let aiContent = "";
    setIsStreaming(true);
    setStopStreaming(false);
    stopStreamingRef.current = false;
    let done = false;

    try {
      const response = await fetch(`${BASE_PATH}/api/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: inputMessage,
          providerConfig: providerConfig,
          conversationId,
          connectionId: selectedConnectionId
        })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let systemMessageId = Date.now();

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: !done });

        // Parse event stream
        const events = chunk.split('\n\n');
        for (const event of events) {
          if (event.startsWith('event:meta')) {
            // Metadata event
            const dataLine = event.split('\n').find(line => line.startsWith('data:'));
            if (dataLine) {
              meta = JSON.parse(dataLine.replace('data:', ''));
              metaReceived = true;

              setConversationId(meta?.conversationId || null);
              const newMessages = (meta && Array.isArray(meta.conversationHistory))
                  ? meta.conversationHistory.map((msg: Message) => {
                    if (msg.sender === "system" && msg.content.startsWith("```sql")) {
                      let sql = msg.content.replace("```sql", "").replace("```", "").trim();
                      if (sql === "") {
                        sql = "Knowledge insufficient, please provide more information.";
                      }
                      return { ...msg, sql };
                    }
                    return msg;
                  })
                  : [];

              setMessages((prev) => [
                ...newMessages,
                { id: systemMessageId, content: "", sender: "system", timestamp: new Date().toISOString() }
              ]);

              if (!conversationId && meta?.conversationId) {
                const newConversation = {
                  id: meta.conversationId,
                  connectionId: selectedConnectionId,
                  title: inputMessage.substring(0, 50) + "...",
                  timestamp: new Date().toISOString(),
                };

                // Update cache
                const currentConversations = conversationsCache.current.get(selectedConnectionId) || [];
                conversationsCache.current.set(selectedConnectionId, [newConversation, ...currentConversations]);
                setCurrentConversation([newConversation, ...currentConversations]);
              }
            }
          } else if (metaReceived) {
            // AI response event (append to content)
            aiContent += event;
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === systemMessageId
                        ? { ...msg, content: aiContent }
                        : msg
                )
            );
          }
        }
        // break if done
        if (done) {
          break;
        }
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
      setIsLoading(false);
      setIsStreaming(false);
      setStopStreaming(false);
      stopStreamingRef.current = false;
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

  const filterHistory = (searchText: string) => {
    if (!selectedConnectionId) return;
    const searchTerm = searchText.toLowerCase();
    const filteredConversations = conversationsCache.current.get(selectedConnectionId)?.filter((conversation) =>
        conversation.title.toLowerCase().includes(searchTerm)
    );
    setCurrentConversation(filteredConversations || []);
  }

  const executeSql = async (sql: string, messageId: number) => {
    setIsStreaming(true);
    setStopStreaming(false);
    stopStreamingRef.current = false;
    leftPanelClosedForStreamingRef.current = false; // Reset for each new execution

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

      // Streaming response handling
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = "";
        let rows: any[] = [];

        while (!done) {
          if (stopStreamingRef.current) {
            await reader.cancel();
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
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === messageId
                      ? { ...msg, result: [...rows] }
                      : msg
                  )
                );
                setActiveQueryResult({
                  result: [...rows],
                  hasError: false
                });
                // Only close left panel once per streaming session
                if (!leftPanelClosedForStreamingRef.current) {
                  setShowResultPanel(true);
                  setShowLeftPanel(false);
                  leftPanelClosedForStreamingRef.current = true;
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
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, result: [...rows] }
                : msg
            )
          );
          setActiveQueryResult({
            result: [...rows],
            hasError: false
          });
          if (!leftPanelClosedForStreamingRef.current) {
            setShowResultPanel(true);
            setShowLeftPanel(false);
            leftPanelClosedForStreamingRef.current = true;
          }
        }
      } else {
        // fallback for non-streaming
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
              data.details?.sqlMessage ||
              data.message ||
              data.error ||
              "An error occurred while executing the SQL query."
          );
        }
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === messageId ? { ...msg, result: data.result } : msg
            )
        );
        setActiveQueryResult({
          result: data.result,
          hasError: false
        });
        setShowResultPanel(true);
        setShowLeftPanel(false); // Always hide left panel when showing results (non-streaming)
      }
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
      setActiveQueryResult({
        result: [{ error: errorMessage }],
        hasError: true
      });
      setShowResultPanel(true);
      setShowLeftPanel(false); // Always hide left panel on error results
    } finally {
      setIsStreaming(false);
      setStopStreaming(false);
      stopStreamingRef.current = false;
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

  const handleShareMessage = async (messageId: number) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/share`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }

      const data = await response.json();
      const shareUrl = `${window.location.origin}/messages/shared/${data.token}`;
      
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Share link generated",
        description: (
          <div className="mt-2">
            <p className="text-sm">Link copied to clipboard:</p>
            <a 
              href={shareUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {shareUrl}
            </a>
          </div>
        ),
      });
    } catch (error) {
      console.error('Error sharing message:', error);
      toast({
        title: "Error",
        description: "Failed to generate share link",
        variant: "destructive",
      });
    }
  };

  const handleEmbedMessage = async (messageId: number) => {
    setEmbedLoading(true);
    try {
      // First, get the share token (reuse share endpoint)
      const response = await fetch(`/api/messages/${messageId}/share`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to generate share token');
      const data = await response.json();
      const token = data.token;
      // Construct embed URL
      const url = `${window.location.origin}/api/messages/${messageId}/embed?token=${token}`;
      setEmbedUrl(url);
      setEmbedCode(`<iframe src=\"${url}\" width=\"600\" height=\"220\" frameborder=\"0\" allowfullscreen></iframe>`);
      setShowEmbedDialog(true);
    } catch (err) {
      // Optionally show toast
    } finally {
      setEmbedLoading(false);
    }
  };

  const renderMessage = (message: Message) => {
    const isAIProviderError = message.content.startsWith(AI_PROVIDER_ERROR);

    const renderContent = (content: string) => {
      const parts = content.split(/(```sql[\s\S]*?```)/);

      return parts.map((part, index) => {
        if (part.startsWith('```sql')) {
          const sql = part.replace('```sql', '').replace('```', '').trim();
          const messageId = message.id;
          const isEditing = editingSqlId === messageId;
          const currentSql = message.editedSql || sql;

          return (
            <div key={index} className="my-3 bg-accent/10 dark:bg-accent/20 text-accent-foreground dark:text-accent-foreground p-3 rounded-lg">
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
                <div className="relative">
                  <Textarea
                    value={currentSql}
                    onChange={(e) => handleSqlEdit(messageId, e.target.value)}
                    className="font-mono bg-gray-800 text-gray-100 p-2 rounded-md w-full min-h-[100px] resize-none sql-editor"
                    style={{ 
                      outline: 'none',
                      caretColor: 'currentColor',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                      MozUserSelect: 'text',
                      msUserSelect: 'text',
                      cursor: 'text'
                    }}
                    onFocus={(e) => {
                      e.target.style.cursor = 'text';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSqlEdit(messageId, currentSql);
                        setEditingSqlId(null);
                      }
                    }}
                    autoFocus
                  />
                  <div className="absolute bottom-2 right-2 flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleSqlEdit(messageId, currentSql);
                        setEditingSqlId(null);
                      }}
                      className="h-8 px-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingSqlId(null);
                      }}
                      className="h-8 px-2 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <pre className="bg-gray-800 text-gray-100 p-2 rounded-md overflow-x-auto">
                  <code>{currentSql}</code>
                </pre>
              )}
              <div className="mt-3 space-x-2">
                <Button
                  onClick={() => explainSQL(currentSql, messageId)}
                  size="sm"
                  variant="default"
                  className="bg-primary hover:bg-primary/80 text-primary-foreground"
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
                  variant="default"
                  className="bg-primary hover:bg-primary/80 text-primary-foreground"
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

    const messageClass = message.sender === "user"
            ? "bg-primary/10 dark:bg-primary/20 text-foreground dark:text-foreground"
            : "bg-secondary dark:bg-secondary text-foreground dark:text-foreground";
    const errorClass = "bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100"

    const renderResult = () => {
      if (!message.result) return null;

      return (
        <div className="max-h-[300px] overflow-auto">
          {Array.isArray(message.result) ? (
            message.result.length === 0 && (
              <Alert>
                <AlertTitle>No Results</AlertTitle>
                <AlertDescription>
                  The query returned no results.
                </AlertDescription>
              </Alert>
            )
          ) : "affectedRows" in message.result ? (
            <Alert>
              <AlertTitle>Query Executed Successfully</AlertTitle>
              <AlertDescription>
                Affected rows: {message.result.affectedRows}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{message.result.error}</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }

    // Map provider names to image paths
    const providerImageMap: { [key: string]: string } = {
      "Azure OpenAI": "/azure-icon.svg",
      "Ollama": "/ollama-icon.svg",
      "LM Studio": "/lmstudio-icon.svg",
      "Claude": "/claude-icon.svg",
      "OpenAI": "/chatgpt-icon.svg",
    };

    // Default to a generic icon if no match is found
    const imagePath = providerImageMap[providerConfig.selectedProvider] || "/chatgpt-icon.svg";


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
          {message.sender === "user" ? (
            <div className="flex items-center space-x-2">
              <Avatar className="w-8 h-8">
                {session?.user?.image ? (
                  <AvatarImage
                    src={session.user.image}
                    alt={session.user.name || 'User avatar'}
                  />
                ) : (
                  <AvatarFallback className="bg-primary/20">
                      <User className="w-5 h-5 text-primary" />
                  </AvatarFallback>
                )}
              </Avatar>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-muted">
                  <Image
                    src={imagePath}
                    alt={`${providerConfig.selectedProvider} Icon`}
                    width={20}
                    height={20}
                  />
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className={`rounded-lg p-3 ${isAIProviderError? errorClass : messageClass} max-w-[600px] shadow-md`}>
            {isAIProviderError ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{message.content}</AlertDescription>
              </Alert>
            ) : (
              renderContent(message.content)
            )}
            {message.result && (
              <div className="mt-3 bg-white dark:bg-gray-800 rounded-md shadow-inner overflow-x-auto">
                {renderResult()}
              </div>
            )}
            <p className="text-xs mt-2 opacity-70">
              {formatJapanTime(message.timestamp)}
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleShareMessage(message.id)}
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEmbedMessage(message.id)}
                disabled={embedLoading}
                aria-label="Embed message"
              >
                <Code className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const filteredConnections = selectedTag
    ? databaseConnections.filter((conn: DatabaseConnection) => {
        if (!conn.tag) return false;
        const tags = conn.tag.split(',').map(t => t.trim());
        return tags.includes(selectedTag);
      })
    : databaseConnections;

  const uniqueTags = Array.from(
    new Set(
      databaseConnections
        .map((conn: DatabaseConnection) => conn.tag?.split(',').map(t => t.trim()) || [])
        .flat()
        .filter(Boolean)
    )
  );

  const handleTagSelect = (tag: string | null) => {
    setSelectedTag(tag);
    if (tag) {
      const firstConn = databaseConnections.find(conn => {
        if (!conn.tag) return false;
        const tags = conn.tag.split(',').map(t => t.trim());
        return tags.includes(tag);
      });
      if (firstConn && typeof firstConn.id === 'number') {
        setSelectedConnectionId(firstConn.id);
      }
    }
  };

  const handleTitleEdit = (conversation: Conversation) => {
    setEditingTitleId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const handleTitleSave = async (conversationId: number) => {
    try {
      const response = await fetch(`${BASE_PATH}/api/conversations/${conversationId}/title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: editingTitle }),
      });

      if (!response.ok) {
        throw new Error('Failed to update title');
      }

      // Update local state
      setCurrentConversation(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, title: editingTitle }
            : conv
        )
      );

      // Update cache
      if (selectedConnectionId) {
        const cachedConversations = conversationsCache.current.get(selectedConnectionId) || [];
        conversationsCache.current.set(
          selectedConnectionId,
          cachedConversations.map(conv =>
            conv.id === conversationId
              ? { ...conv, title: editingTitle }
              : conv
          )
        );
      }

      setEditingTitleId(null);
      setEditingTitle("");
    } catch (error) {
      console.error('Error updating title:', error);
      toast({
        title: "Error",
        description: "Failed to update conversation title",
        variant: "destructive",
      });
    }
  };

  // Function to toggle the left panel visibility (for mobile/narrow screens)
  const toggleLeftPanel = () => {
    setShowLeftPanel(prev => !prev);
  };

  // Function to close the result panel
  const closeResultPanel = () => {
    setShowResultPanel(false);
    setShowLeftPanel(true);
    setActiveQueryResult(null);
  };

  // Modify the viewResultInPanel function to handle left panel visibility
  const viewResultInPanel = (result: QueryResult[] | QueryResponse, hasError: boolean) => {
    setActiveQueryResult({
      result,
      hasError
    });
    setShowResultPanel(true);
    // Always hide left panel when result panel is shown
    setShowLeftPanel(false);
  };

  // Add useEffect to handle screen size changes and SQL panel interaction
  useEffect(() => {
    const handleResize = () => {
      const isLarge = window.innerWidth >= 1280;
      const isMedium = window.innerWidth >= 768 && window.innerWidth < 1280;
      
      setScreenSize({
        isLarge,
        isMedium
      });
      
      // When result panel is shown, always hide left panel regardless of screen size
      if (showResultPanel) {
        setShowLeftPanel(false);
      }
      // On large screens (xl and above), show left panel when result panel is not shown
      else if (isLarge) {
        setShowLeftPanel(true);
      }
    };

    window.addEventListener('resize', handleResize);
    // Run once on mount and when result panel visibility changes
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [showResultPanel]); // Re-run when showResultPanel changes

  // Function to handle resizing between chat and SQL panels
  const handlePanelResize = (newPosition: number) => {
    setPanelSplit(newPosition);
    // Save preference to localStorage for persistence
    localStorage.setItem('panelSplitPosition', newPosition.toString());
  };

  // Load saved panel split preference on mount
  useEffect(() => {
    const savedSplit = localStorage.getItem('panelSplitPosition');
    if (savedSplit) {
      setPanelSplit(parseFloat(savedSplit));
    }
  }, []);

  // Fetch recommendations on input focus or when input changes
  useEffect(() => {
    if (!showRecommendations) return;
    const fetchRecommendations = async () => {
      try {
        const res = await fetch('/api/recommendations?limit=10');
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      } catch (err) {
        setRecommendations([]);
      }
    };
    fetchRecommendations();
  }, [showRecommendations]);

  // Hide dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (recommendationsRef.current && !recommendationsRef.current.contains(event.target as Node)) {
        setShowRecommendations(false);
      }
    }
    if (showRecommendations) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRecommendations]);

  // Recommendation dropdown keyboard navigation and accessibility
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownActive, setDropdownActive] = useState(false); // Track if user is navigating dropdown
  const leftPanelClosedForStreamingRef = useRef(false);

  // Keyboard navigation for recommendations
  useEffect(() => {
    if (!showRecommendations || recommendations.length === 0) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex(0);
  }, [showRecommendations, recommendations.length]);

  const handleRecommendationKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showRecommendations || recommendations.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownActive(true);
      setHighlightedIndex((prev) => (prev + 1) % recommendations.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDropdownActive(true);
      setHighlightedIndex((prev) => (prev - 1 + recommendations.length) % recommendations.length);
    } else if (e.key === 'Enter') {
      if (dropdownActive && highlightedIndex >= 0 && highlightedIndex < recommendations.length) {
        setInputMessage(recommendations[highlightedIndex]);
        setShowRecommendations(false);
        setDropdownActive(false);
        e.preventDefault();
      } else {
        setDropdownActive(false);
      }
    } else if (e.key === 'Escape') {
      setShowRecommendations(false);
      setDropdownActive(false);
    } else {
      setDropdownActive(false);
    }
  };

  if (status === "loading" || appLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (showAuth && !session) {
    return <UnauthorizedAccess />;
  }

  return (
    <Box className="min-h-screen">
      <div className="container mx-auto py-2 px-2">
        <ChatHeader
          showLeftPanel={showLeftPanel}
          toggleLeftPanel={toggleLeftPanel}
          showAuth={showAuth}
          session={session}
          signOut={signOut}
          signIn={signIn}
        />
        <div className={`flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 relative`}>
          {/* Left panel (databases and history) - hidden when SQL result panel is */}
          {showLeftPanel && (
            <div className="w-full lg:w-1/5 lg:min-w-[220px] xl:min-w-[250px] bg-white dark:bg-gray-900 lg:bg-transparent lg:dark:bg-transparent">
              <DatabaseSidebar
                uniqueTags={uniqueTags}
                selectedTag={selectedTag}
                handleTagSelect={handleTagSelect}
                filteredConnections={filteredConnections}
                selectedConnectionId={selectedConnectionId}
                handleConnectionSelect={handleConnectionSelect}
              />
              <HistorySidebar
                currentConversation={currentConversation}
                conversationId={conversationId}
                editingTitleId={editingTitleId}
                editingTitle={editingTitle}
                handleTitleEdit={handleTitleEdit}
                handleTitleSave={handleTitleSave}
                setEditingTitle={setEditingTitle}
                setEditingTitleId={setEditingTitleId}
                handleConversationClick={handleConversationClick}
                handleNewConversation={handleNewConversation}
                filterHistory={filterHistory}
              />
            </div>
          )}
          {/* Resizable container for chat and SQL panels */}
          <div 
            id="resizable-container" 
            className="flex flex-1 h-[calc(100vh-120px)] overflow-hidden"
          >
            {/* Chat panel */}
            <div 
              style={{ 
                width: showResultPanel ? `${panelSplit}%` : '100%',
                minWidth: showResultPanel ? '20%' : '100%',
                maxWidth: showResultPanel ? '80%' : '100%',
                transition: showResultPanel ? 'none' : 'width 0.2s ease-in-out'
              }}
              className="flex flex-col h-full"
            >
              <Card className="flex-1 flex flex-col bg-card border border-border shadow-md overflow-hidden">
                <CardContent className="flex-1 overflow-hidden p-4 relative">
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-4 h-[calc(80vh-65px)]">
                      {messages.length === 0 && (
                        <div className="text-center">
                          <p className="text-muted-foreground dark:text-muted-foreground">
                            Start a conversation by typing your query.<br />Here are the available tables in your database:
                          </p>
                          <div className="mt-4">
                            <TagCloud className="mt-4" tags={listOfDBTables} />
                          </div>
                        </div>
                      )}
                      {messages.map(renderMessage)}
                      <div ref={messagesEndRef} />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={scrollToBottom}
                      aria-label="Scroll to Bottom"
                      className="absolute bottom-0 right-4 z-10 shadow-lg"
                    >
                      <ArrowDown className="w-4 h-4 mr-1" />
                    </Button>
                  </ScrollArea>
                </CardContent>
                <CardContent className="p-3 border-t border-border bg-secondary dark:bg-secondary rounded-b-lg">
                  <ChatInput
                    inputMessage={inputMessage}
                    setInputMessage={setInputMessage}
                    handleSendMessage={handleSendMessage}
                    handleStopStreaming={handleStopStreaming}
                    isLoading={isLoading}
                    isStreaming={isStreaming}
                    selectedConnectionId={selectedConnectionId}
                    handleRecommendationKeyDown={handleRecommendationKeyDown}
                    showRecommendations={showRecommendations}
                    dropdownActive={dropdownActive}
                    highlightedIndex={highlightedIndex}
                    recommendations={recommendations}
                    setShowRecommendations={setShowRecommendations}
                    setDropdownActive={setDropdownActive}
                  />
                  <NoDatabaseAlert show={!selectedConnectionId} />
                </CardContent>
              </Card>
            </div>
            {/* End Chat panel */}
            {/* SQL Result panel and splitter */}
            {showResultPanel && (
              <>
                <ResizableSplitter
                  onResize={handlePanelResize}
                  initialPosition={panelSplit}
                  minLeftWidth={20}
                  minRightWidth={20}
                  className="h-full flex-shrink-0"
                />
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
              </>
            )}
          </div>
        </div>
      </div>
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm SQL Execution</AlertDialogTitle>
            <AlertDialogDescription>
              This SQL query may modify the database. Are you sure you want to proceed?
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

      <Dialog open={showEmbedDialog} onOpenChange={setShowEmbedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Embed This Message</DialogTitle>
            <DialogDescription>
              Copy and paste this iframe code to embed the message in your website or blog.
            </DialogDescription>
          </DialogHeader>
          <div className="mb-2">
            <label className="block text-xs font-semibold mb-1">Embed Code</label>
            <Textarea
              value={embedCode}
              readOnly
              className="font-mono text-xs bg-gray-100 dark:bg-gray-900"
              rows={3}
              onFocus={e => e.target.select()}
            />
            <Button
              className="mt-2"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(embedCode);
                setEmbedCopied(true);
                setTimeout(() => setEmbedCopied(false), 2000);
              }}
            >
              Copy Embed Code
            </Button>
            {embedCopied && (
              <span className="ml-2 text-green-600 text-xs font-medium">Copied!</span>
            )}
          </div>
          <div className="mt-4">
            <label className="block text-xs font-semibold mb-1">Preview</label>
            <iframe
              src={embedUrl}
              width="100%"
              height="220"
              frameBorder="0"
              style={{ borderRadius: 8, background: '#fff' }}
              title="Embedded Message Preview"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
