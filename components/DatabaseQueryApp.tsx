"use client";

import React, {useState, useEffect, useRef, useContext} from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@radix-ui/themes";
import { cacheStorage } from "@/lib/indexeddb";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
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
  Code,
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
import TableFieldSelector from './TableFieldSelector';
import { v4 as uuidv4 } from 'uuid';

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
  id: string;
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

interface SelectedTable {
  name: string;
  fields: string[];
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
    messageId: string;
  } | null>(null);
  const [databaseConnections, setDatabaseConnections] = useState<
    DatabaseConnection[]
  >([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    number | null
  >(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [editingSqlId, setEditingSqlId] = useState<{messageId: string, sqlIndex: number} | null>(null);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  //  different state from send button loading operation, so that support multiple operations at the same time
  const [loadingOperation, setLoadingOperation] = useState<{ type: 'explain' | 'run' | null; messageId: string | null }>({ type: null, messageId: null });
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
  const leftPanelClosedForStreamingRef = useRef(false);

  // Chat panel selector state - defaults to TagCloud, with IndexedDB persistence
  const [chatPanelMode, setChatPanelMode] = useState<'tagcloud' | 'fieldselector'>('tagcloud');
  const [selectedTablesFromTagCloud, setSelectedTablesFromTagCloud] = useState<string[]>([]);

  // Embed functionality state
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [embedCode, setEmbedCode] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);


  useEffect(() => {
    let isMounted = true;
    
    // Clean up expired cache entries first
    cleanupCache();
    
    // Load all cached data for instant display
    loadCachedData();
    
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

  const loadCachedData = async () => {
    try {
      // Load cached database connections with TTL validation
      const cachedConnections = await cacheStorage.getItem('dbConnectionsCache', 30); // 30 minute TTL
      if (cachedConnections) {
        const connections = cachedConnections.connections || cachedConnections;
        setDatabaseConnections(connections);
        if (connections.length > 0) {
          setSelectedConnectionId(connections[0].id);
        }
        setAppLoading(false);
      }

      // Load cached selected tag
      const cachedTag = await cacheStorage.getItem('selectedDatabaseTag', 60); // 1 hour TTL
      if (cachedTag) {
        setSelectedTag(cachedTag);
      }

      // Load cached chat panel mode preference
      const cachedMode = await cacheStorage.getItem('chatPanelMode', 1440); // 24 hours TTL
      if (cachedMode && (cachedMode === 'tagcloud' || cachedMode === 'fieldselector')) {
        setChatPanelMode(cachedMode as 'tagcloud' | 'fieldselector');
      }
    } catch (err) {
      console.error('Error loading cached data:', err);
    }
  };

  // Add beforeunload event listener to prevent accidental navigation
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only show confirmation if there are active messages or ongoing operations
      if (messages.length > 0 || isLoading || isStreaming) {
        event.preventDefault();
        event.returnValue = 'You have unsaved work. Are you sure you want to leave?';
        return 'You have unsaved work. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [messages.length, isLoading, isStreaming]);

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
      cacheStorage.setItem('selectedDatabaseTag', selectedTag, 60).catch(err => {
        console.warn('Failed to cache selected tag:', err);
      });
    } else {
      cacheStorage.removeItem('selectedDatabaseTag').catch(err => {
        console.warn('Failed to remove selected tag cache:', err);
      });
    }
  }, [selectedTag]);

  // Persist chat panel mode preference
  useEffect(() => {
    cacheStorage.setItem('chatPanelMode', chatPanelMode, 1440).catch(err => {
      console.warn('Failed to cache chat panel mode:', err);
    });
  }, [chatPanelMode]);

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
      
      // Cache with IndexedDB
      const cacheData = {
        connections: data.databaseConnections,
        timestamp: Date.now()
      };
      await cacheStorage.setItem('dbConnectionsCache', cacheData, 30); // 30 minute TTL
      
      if (data.databaseConnections.length > 0 && !selectedConnectionId) {
        setSelectedConnectionId(data.databaseConnections[0].id);
      }
    } catch (error) {
      console.error("Error fetching database connections:", error);
    }
  };

  // Clean up expired cache entries (IndexedDB handles TTL automatically)
  const cleanupCache = async () => {
    try {
      // IndexedDB implementation handles TTL automatically during getItem calls
      // No manual cleanup needed as expired items are filtered out when retrieved
    } catch (err) {
      console.warn('Error cleaning up cache:', err);
    }
  };

  const fetchListOfDBTables = async () => {
    if (!selectedConnectionId) return;
    
    // Check cache first
    const cacheKey = `dbTables_${selectedConnectionId}`;
    const cached = await cacheStorage.getItem(cacheKey, 10); // 10 minute TTL
    if (cached) {
      try {
        const tables = cached.tables || cached;
        setListOfDBTables(tables);
        return;
      } catch (err) {
        console.error('Error parsing cached tables:', err);
      }
    }

    try {
      const response = await fetch(`${BASE_PATH}/api/db-tables/${selectedConnectionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch database tables");
      }
      const data = await response.json();
      setListOfDBTables(data);
      
      // Cache the tables
      await cacheStorage.setItem(cacheKey, {
        tables: data,
        timestamp: Date.now()
      }, 10); // 10 minute TTL
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

    // Check IndexedDB cache
    const cacheKey = `conversations_${connectionId}`;
    const cached = await cacheStorage.getItem(cacheKey, 5); // 5 minute TTL
    if (cached) {
      try {
        const conversations = cached.conversations || cached;
        conversationsCache.current.set(connectionId, conversations);
        setCurrentConversation(conversations);
        return;
      } catch (err) {
        console.error('Error parsing cached conversations:', err);
      }
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
      
      // Cache to IndexedDB
      await cacheStorage.setItem(cacheKey, {
        conversations,
        timestamp: Date.now()
      }, 5); // 5 minute TTL
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
      id: uuidv4(),
      content: inputMessage,
      sender: "user",
      timestamp: formatJapanTime(new Date().toISOString()),
    };
    setMessages((prev) => [...prev, tempMessage]);

    setIsLoading(true);
    let metaReceived = false;
    let meta: { conversationId: number; conversationHistory: any; systemMessageId?: string } | null = null;
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
      let systemMessageId = uuidv4(); // fallback, will be replaced by meta

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

              // Use the actual database message ID from backend
              if (meta?.systemMessageId) {
                systemMessageId = meta.systemMessageId;
              }

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

              // Check if the system message already exists in conversation history (it will now, since backend creates it)
              const messageExists = newMessages.some(msg => msg.id === systemMessageId);
              
              setMessages((prev) => [
                ...newMessages,
                // Only add empty message if it doesn't already exist in conversation history
                ...(messageExists ? [] : [{ id: systemMessageId, content: "", sender: "system" as const, timestamp: new Date().toISOString() }])
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
        id: uuidv4(),
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
      
      // Refresh conversation messages to get actual database IDs after streaming completes
      if (conversationId) {
        setTimeout(async () => {
          try {
            const response = await fetch(
              `${BASE_PATH}/api/conversations/${conversationId}?connectionId=${selectedConnectionId}`
            );
            if (response.ok) {
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
            }
          } catch (error) {
            console.error("Error refreshing conversation messages:", error);
          }
        }, 500); // Small delay to ensure database operations are complete
      }
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

  const runSQL = async (sql: string, messageId: string) => {
    if (checkForSideEffects(sql)) {
      setPendingSql({ sql, messageId });
      setShowConfirmDialog(true);
    } else {
      setLoadingOperation({ type: 'run', messageId });
      await executeSql(sql, messageId);
      setLoadingOperation({ type: null, messageId: null });
    }
  };

  const explainSQL = async (sql: string, messageId: string) => {
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

  const executeSql = async (sql: string, messageId: string) => {
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

  const copyToClipboard = (text: string, messageId: string) => {
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

  const handleSqlEdit = (messageId: string, sqlIndex: number, sql: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, [`editedSql_${sqlIndex}`]: sql } : msg
    ));
  };

  const handleSqlSave = async (messageId: string, sqlIndex: number) => {
    const message = messages.find(msg => msg.id === messageId);
    if (!message) return;

    const editedSqlKey = `editedSql_${sqlIndex}`;
    const editedSql = (message as any)[editedSqlKey];
    if (!editedSql) return;

    // Split content by SQL blocks and update the specific one
    const parts = message.content.split(/(```sql[\s\S]*?```)/);
    let sqlBlockIndex = 0;
    
    const updatedParts = parts.map(part => {
      if (part.startsWith('```sql')) {
        if (sqlBlockIndex === sqlIndex) {
          sqlBlockIndex++;
          return `\`\`\`sql\n${editedSql}\n\`\`\``;
        }
        sqlBlockIndex++;
      }
      return part;
    });

    const updatedContent = updatedParts.join('');

    try {
      // Save to backend
      const response = await fetch(`${BASE_PATH}/api/messages/${messageId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: updatedContent }),
      });

      if (!response.ok) {
        throw new Error('Failed to save SQL changes');
      }

      // Update local state - also update the sql field for the specific SQL block
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const updatedMsg = { ...msg, content: updatedContent };
          // Clear the edited SQL
          delete (updatedMsg as any)[editedSqlKey];
          
          // Update the sql field if this is the first SQL block
          if (sqlIndex === 0) {
            updatedMsg.sql = editedSql;
          }
          
          return updatedMsg;
        }
        return msg;
      }));
      
      setEditingSqlId(null);

      toast({
        title: "SQL Updated",
        description: "Your SQL changes have been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving SQL:', error);
      toast({
        title: "Error",
        description: "Failed to save SQL changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShareMessage = async (messageId: string) => {
    try {
      // Check if this is a recent message that might not be saved yet
      const message = messages.find(msg => msg.id === messageId);
      const isRecentMessage = message && (Date.now() - new Date(message.timestamp).getTime()) < 3000; // Less than 3 seconds old
      
      // For recent messages, add a small delay to allow database operations to complete
      if (isRecentMessage) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const response = await fetch(`/api/messages/${messageId}/share`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific error cases
        if (response.status === 404) {
          // If message not found, suggest waiting and trying again
          toast({
            title: "Message not ready",
            description: "The message is still being processed. Please wait a moment and try again.",
            variant: "destructive",
          });
          return;
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Invalid message');
        } else {
          throw new Error(errorData.error || 'Failed to generate share link');
        }
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate share link';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleEmbedMessage = async (messageId: string) => {
    setEmbedLoading(true);
    try {
      // Check if this is a recent message that might not be saved yet
      const message = messages.find(msg => msg.id === messageId);
      const isRecentMessage = message && (Date.now() - new Date(message.timestamp).getTime()) < 3000; // Less than 3 seconds old
      
      // For recent messages, add a small delay to allow database operations to complete
      if (isRecentMessage) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // First, get the share token (reuse share endpoint)
      const response = await fetch(`/api/messages/${messageId}/share`, { method: 'POST' });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific error cases
        if (response.status === 404) {
          throw new Error(errorData.error || 'Message not found or has been deleted');
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Invalid message');
        } else {
          throw new Error(errorData.error || 'Failed to generate embed code');
        }
      }
      
      const data = await response.json();
      const token = data.token;
      // Construct embed URL
      const url = `${window.location.origin}/api/messages/${messageId}/embed?token=${token}`;
      setEmbedUrl(url);
      setEmbedCode(`<iframe src=\"${url}\" width=\"600\" height=\"220\" frameborder=\"0\" allowfullscreen></iframe>`);
      setShowEmbedDialog(true);
    } catch (error) {
      console.error('Error generating embed code:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate embed code';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setEmbedLoading(false);
    }
  };

  const handleGenerateQueryFromTables = (selectedTables: SelectedTable[]) => {
    if (selectedTables.length === 0) return;

    let queryMessage = "Please help me create a SQL query to ";
    
    if (selectedTables.length === 1) {
      const table = selectedTables[0];
      if (table.fields.length === 0) {
        queryMessage += `select all fields from the ${table.name} table with LIMIT 10 records.`;
      } else {
        queryMessage += `select the following fields: ${table.fields.join(', ')} from the ${table.name} table with LIMIT 10 records.`;
      }
    } else {
      queryMessage += "join the following tables and select the specified fields:\n\n";
      selectedTables.forEach((table, index) => {
        if (table.fields.length === 0) {
          queryMessage += `${index + 1}. Table: ${table.name} - select all fields\n`;
        } else {
          queryMessage += `${index + 1}. Table: ${table.name} - select fields: ${table.fields.join(', ')}\n`;
        }
      });
      
      // Add intelligent guidance for potential join relationships
      queryMessage += "\nPlease create an appropriate JOIN query based on the relationships between these tables and add LIMIT 10 to show only the first 10 records.";
      
      // Analyze table names for potential relationships
      const tableNames = selectedTables.map(t => t.name.toLowerCase());
      const potentialJoinHints = [];
      
      // Look for common patterns that suggest relationships
      const commonIdPatterns = ['id', '_id', 'user_id', 'customer_id', 'order_id', 'product_id', 'category_id'];
      const commonForeignKeyPatterns = tableNames.map(name => [`${name}_id`, `${name.replace(/s$/, '')}_id`]).flat();
      
      // Check for potential foreign key relationships
      for (let i = 0; i < tableNames.length; i++) {
        for (let j = i + 1; j < tableNames.length; j++) {
          const table1 = tableNames[i];
          const table2 = tableNames[j];
          
          // Check if one table name appears in the other (e.g., "user" and "user_orders")
          if (table1.includes(table2) || table2.includes(table1)) {
            potentialJoinHints.push(`${table1} and ${table2} may be related`);
          }
          
          // Check for common naming patterns
          const singular1 = table1.replace(/s$/, '');
          const singular2 = table2.replace(/s$/, '');
          
          if (commonForeignKeyPatterns.includes(`${singular1}_id`) || commonForeignKeyPatterns.includes(`${singular2}_id`)) {
            potentialJoinHints.push(`Look for ${singular1}_id or ${singular2}_id fields`);
          }
        }
      }
      
      // Add hints if tables might not be directly joinable
      if (potentialJoinHints.length === 0 && selectedTables.length > 2) {
        queryMessage += "\n\n⚠️ **Important**: If these tables don't have direct relationships, consider:";
        queryMessage += "\n- Using UNION instead of JOIN if the tables have similar structures";
        queryMessage += "\n- Creating separate queries for each table";
        queryMessage += "\n- Looking for intermediate/junction tables that might connect them";
        queryMessage += `\n- Common joining patterns to look for: ${commonIdPatterns.join(', ')}`;
      } else if (potentialJoinHints.length > 0) {
        queryMessage += "\n\n💡 **Potential relationships detected**:";
        potentialJoinHints.forEach(hint => {
          queryMessage += `\n- ${hint}`;
        });
      }
      
      // Add guidance for tables that might not be related
      if (selectedTables.length > 2) {
        queryMessage += "\n\nIf some tables cannot be joined directly, please suggest alternative approaches like separate queries or UNION operations where appropriate.";
      }
    }

    setInputMessage(queryMessage);
  };

  const handleTagCloudTableClick = (tableName: string) => {
    setSelectedTablesFromTagCloud(prev => {
      if (prev.includes(tableName)) {
        return prev.filter(t => t !== tableName);
      } else {
        return [...prev, tableName];
      }
    });
  };

  const handleTagCloudGenerateQuery = () => {
    if (selectedTablesFromTagCloud.length === 0) return;
    
    const selectedTables = selectedTablesFromTagCloud.map(tableName => ({
      name: tableName,
      fields: [] // Empty fields array means select all fields
    }));
    
    handleGenerateQueryFromTables(selectedTables);
  };

  const handleClearTagCloudSelection = () => {
    setSelectedTablesFromTagCloud([]);
  };

  const renderMessage = (message: Message) => {
    const isAIProviderError = message.content.startsWith(AI_PROVIDER_ERROR);

    const renderContent = (content: string) => {
      const parts = content.split(/(```sql[\s\S]*?```)/);
      let sqlBlockIndex = 0;

      return parts.map((part, index) => {
        if (part.startsWith('```sql')) {
          const sql = part.replace('```sql', '').replace('```', '').trim();
          const messageId = message.id;
          const currentSqlIndex = sqlBlockIndex;
          sqlBlockIndex++;
          const isEditing = editingSqlId?.messageId === messageId && editingSqlId?.sqlIndex === currentSqlIndex;
          const editedSqlKey = `editedSql_${currentSqlIndex}`;
          // Use edited SQL if available, otherwise use the SQL from the current content part
          const currentSql = (message as any)[editedSqlKey] || sql;

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
                          onClick={() => isEditing ? handleSqlSave(messageId, currentSqlIndex) : setEditingSqlId({messageId, sqlIndex: currentSqlIndex})}
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
                    onChange={(e) => handleSqlEdit(messageId, currentSqlIndex, e.target.value)}
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
                        handleSqlSave(messageId, currentSqlIndex);
                      }
                    }}
                    autoFocus
                  />
                  <div className="absolute bottom-2 right-2 flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSqlSave(messageId, currentSqlIndex)}
                      className="h-8 px-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Clear any edited SQL for this specific block
                        setMessages(prev => prev.map(msg => {
                          if (msg.id === messageId) {
                            const updatedMsg = { ...msg };
                            delete (updatedMsg as any)[`editedSql_${currentSqlIndex}`];
                            return updatedMsg;
                          }
                          return msg;
                        }));
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
                      setMessages(prev => prev.map(msg => {
                        if (msg.id === messageId) {
                          const updatedMsg = { ...msg };
                          delete (updatedMsg as any)[`editedSql_${currentSqlIndex}`];
                          return updatedMsg;
                        }
                        return msg;
                      }));
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
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User avatar'}
                    className="w-full h-full object-cover"
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
            <div className="mt-2 flex justify-end space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleShareMessage(message.id)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Share Message</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEmbedMessage(message.id)}
                    >
                      <Code className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy Embed URL</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
    // Save preference to IndexedDB for persistence
    cacheStorage.setItem('panelSplitPosition', newPosition, 1440).catch(err => {
      console.warn('Failed to save panel split position:', err);
    });
  };

  // Load saved panel split preference on mount
  useEffect(() => {
    const loadPanelSplit = async () => {
      try {
        const savedSplit = await cacheStorage.getItem('panelSplitPosition', 1440); // 24 hours TTL
        if (savedSplit) {
          setPanelSplit(parseFloat(savedSplit.toString()));
        }
      } catch (err) {
        console.warn('Failed to load panel split position:', err);
      }
    };
    loadPanelSplit();
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
        <div className="flex justify-between items-center pb-2">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLeftPanel}
              className="mr-2 "
              aria-label={showLeftPanel ? "Hide sidebar" : "Show sidebar"}
            >
              {showLeftPanel ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <h1 className="text-2xl items-center font-bold p-2">
              Chat
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {showAuth && (
              session ? (
                <div className="flex items-center space-x-2">
                  <Avatar className="w-8 h-8">
                    {session.user?.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user?.name || 'User avatar'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <AvatarFallback>
                        {session.user?.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{session.user?.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{session.user?.email}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signOut()}
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signIn('github')}
                >
                  Sign In
                </Button>
              )
            )}
          </div>
        </div>

        <div className={`flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 relative`}>
          {/* Left panel (databases and history) - hidden when SQL result panel is */}
          {showLeftPanel && (
            <div className="w-full lg:w-1/5 lg:min-w-[220px] xl:min-w-[250px] bg-white dark:bg-gray-900 lg:bg-transparent lg:dark:bg-transparent">
              <Card className="mb-2 h-[calc(100vh-350px)] flex flex-col bg-card border border-border shadow-md">
                <CardHeader className="border-b border-border py-2 flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">
                      Databases
                    </h2>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                  <div className="flex flex-col h-full min-h-0">
                    {uniqueTags.length > 0 && (
                      <div className="mb-2 mt-2 px-2 flex-shrink-0">
                        <div className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-2">Filter by Tags</div>
                        <div className="flex flex-wrap gap-1 overflow-y-auto">
                          <Button
                            variant={!selectedTag ? "default" : "outline"}
                            size="sm"
                            className={`px-2 py-1 text-xs ${
                              !selectedTag ? "bg-primary hover:bg-primary/80 text-primary-foreground" : "hover:border-primary/50 dark:hover:border-primary/70"
                            }`}
                            onClick={() => handleTagSelect(null)}
                          >
                            All
                          </Button>
                          {uniqueTags.map(tag => (
                            <Button
                              key={tag}
                              variant={selectedTag === tag ? "default" : "outline"}
                              size="sm"
                              className={`px-2 py-1 text-xs ${
                                selectedTag === tag ? "bg-primary hover:bg-primary/80 text-primary-foreground" : "hover:border-primary/50 dark:hover:border-primary/70"
                              }`}
                              onClick={() => handleTagSelect(tag)}
                            >
                              {tag}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <ul className="divide-y divide-border">
                        {filteredConnections.map((connection) => (
                          <li
                            key={connection.id}
                            className={`list-item px-2 py-1 cursor-pointer flex items-center ${
                              selectedConnectionId === connection.id
                              ? "selected font-medium text-foreground dark:text-foreground pl-2"
                              : "text-foreground dark:text-foreground"
                            }`}
                            onClick={() => handleConnectionSelect(connection.id)}
                          >
                            <div className="flex items-center w-full">
                              <Database className={`h-4 w-4 mr-2 ${
                                selectedConnectionId === connection.id
                                ? "text-primary dark:text-primary"
                                : "text-muted-foreground dark:text-muted-foreground"
                              }`} />
                              <span className="text-xs font-medium truncate">{connection.projectName}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="h-[225px] flex flex-col bg-card border border-border shadow-md">
                <CardHeader className="border-b border-border py-2">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">
                      History
                    </h2>
                    <Button
                      onClick={handleNewConversation}
                      variant="outline"
                      size="sm"
                      className="text-primary dark:text-primary border-primary dark:border-primary btn-hover-enhanced px-2 py-1 text-xs"
                    >
                      New Chat
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-2 border-b border-gray-100">
                    <Input
                      placeholder="Search..."
                      className="h-7 text-xs border border-gray-300 rounded-md px-2 w-full"
                      onChange={(e) => filterHistory(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[140px]">
                    <div className="">
                      <ul className="divide-y divide-border">
                        {selectedConnectionId &&
                          currentConversation?.map((conversation) => (
                            <li
                              key={conversation.id}
                              className={`list-item px-2 py-1 cursor-pointer flex items-center ${
                                conversation.id === conversationId
                                  ? "selected font-medium text-foreground dark:text-foreground"
                                  : "text-foreground dark:text-foreground"
                              }`}
                            >
                              <div className="flex items-center justify-between w-full pr-1">
                                {editingTitleId === conversation.id ? (
                                  <div className="flex-1 mr-1">
                                    <Input
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleTitleSave(conversation.id);
                                        } else if (e.key === 'Escape') {
                                          setEditingTitleId(null);
                                          setEditingTitle("");
                                        }
                                      }}
                                      className="h-6 text-xs px-1 bg-background dark:bg-background text-foreground dark:text-foreground"
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className="flex-1 truncate"
                                    onClick={() => handleConversationClick(conversation)}
                                  >
                                    <p className="text-xs font-medium truncate">
                                      {conversation.title}
                                    </p>
                                  </div>
                                )}
                                <div className="flex items-center space-x-1 flex-shrink-0">
                                  {editingTitleId === conversation.id ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleTitleSave(conversation.id)}
                                        className="h-6 w-6 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 btn-hover-enhanced"
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setEditingTitleId(null);
                                          setEditingTitle("");
                                        }}
                                        className="h-6 w-6 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground btn-hover-enhanced"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTitleEdit(conversation);
                                      }}
                                      className="h-6 w-6 text-muted-foreground dark:text-muted-foreground hover:text-primary dark:hover:text-primary btn-hover-enhanced"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
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
                          <div className="h-full">
                            <div className="flex justify-between items-center mb-4">
                              <p className="text-center text-muted-foreground dark:text-muted-foreground">
                                Select tables to generate a query, or start typing your own query below.
                              </p>
                              <div className="flex rounded-lg border border-border bg-background p-1">
                                <Button
                                  variant={chatPanelMode === 'tagcloud' ? 'default' : 'ghost'}
                                  size="sm"
                                  onClick={() => setChatPanelMode('tagcloud')}
                                  className="text-xs px-3 py-1"
                                >
                                  Quick Select
                                </Button>
                                <Button
                                  variant={chatPanelMode === 'fieldselector' ? 'default' : 'ghost'}
                                  size="sm"
                                  onClick={() => setChatPanelMode('fieldselector')}
                                  className="text-xs px-3 py-1"
                                >
                                  Field Selector
                                </Button>
                              </div>
                            </div>
                            <div className="h-[calc(100%-4rem)]">
                              {chatPanelMode === 'tagcloud' ? (
                                <div className="h-full flex flex-col">
                                  <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-semibold text-foreground">Database Tables</h3>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleClearTagCloudSelection}
                                        disabled={selectedTablesFromTagCloud.length === 0}
                                        className="text-xs"
                                      >
                                        Clear
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={handleTagCloudGenerateQuery}
                                        disabled={selectedTablesFromTagCloud.length === 0}
                                        className="bg-primary hover:bg-primary/80 text-primary-foreground text-xs"
                                      >
                                        Generate Query
                                      </Button>
                                    </div>
                                  </div>
                                  {selectedTablesFromTagCloud.length > 0 && (
                                    <div className="mb-3 p-2 bg-secondary/50 rounded-md">
                                      <p className="text-xs text-muted-foreground mb-1">Selected tables:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {selectedTablesFromTagCloud.map(tableName => (
                                          <span key={tableName} className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                            {tableName}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex-1 overflow-hidden">
                                    <TagCloud
                                      tags={listOfDBTables}
                                      onTagClick={handleTagCloudTableClick}
                                      selectedTags={selectedTablesFromTagCloud}
                                      className="h-full"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <TableFieldSelector
                                  tables={listOfDBTables}
                                  selectedConnectionId={selectedConnectionId}
                                  onGenerateQuery={handleGenerateQueryFromTables}
                                />
                              )}
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
                  <div className="flex space-x-2 relative" ref={recommendationsRef}>
                    <Textarea
                      value={inputMessage}
                      onChange={(e) => {
                        setInputMessage(e.target.value);
                        setShowRecommendations(true);
                        setDropdownActive(false);
                      }}
                      placeholder="Type your query..."
                      onFocus={() => setShowRecommendations(true)}
                      onBlur={() => setDropdownActive(false)}
                      onKeyDown={(e) => {
                        handleRecommendationKeyDown(e);
                        // Only send if not actively selecting a dropdown item
                        if (
                          e.key === 'Enter' &&
                          !e.shiftKey &&
                          (!showRecommendations || !dropdownActive || highlightedIndex === -1)
                        ) {
                          e.preventDefault();
                          handleSendMessage();
                          setShowRecommendations(false);
                          setDropdownActive(false);
                        }
                      }}
                      className="flex-1 min-h-[30px] max-h-[100px] resize-y"
                      disabled={!selectedConnectionId}
                      aria-autocomplete="list"
                      aria-controls={showRecommendations ? 'recommendations-list' : undefined}
                      aria-activedescendant={highlightedIndex >= 0 ? `recommendation-item-${highlightedIndex}` : undefined}
                      aria-expanded={showRecommendations}
                      role="combobox"
                    />
                    {showRecommendations && recommendations.length > 0 && (
                      <ul
                        id="recommendations-list"
                        role="listbox"
                        aria-label="Recent queries"
                        className="absolute left-0 bottom-full mb-2 w-full bg-background border border-border rounded-lg shadow-lg z-20 max-h-48 overflow-auto transition-all duration-200 ease-in-out"
                        style={{
                          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                          animation: 'fadeInDropdown 0.18s cubic-bezier(0.4,0,0.2,1)',
                        }}
                      >
                        {recommendations
                          .filter((rec) =>
                            inputMessage.length === 0 || rec.toLowerCase().includes(inputMessage.toLowerCase())
                          )
                          .map((rec, idx) => (
                            <li
                              key={idx}
                              id={`recommendation-item-${idx}`}
                              role="option"
                              aria-selected={highlightedIndex === idx}
                              className={`list-item px-3 py-2 cursor-pointer text-sm ${
                                highlightedIndex === idx
                                  ? 'selected font-medium text-foreground dark:text-foreground pl-3'
                                  : 'text-foreground dark:text-foreground'
                              }`}
                              onMouseDown={() => {
                                setInputMessage(rec);
                                setShowRecommendations(false);
                                setDropdownActive(false);
                              }}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                            >
                              {rec}
                            </li>
                          ))}
                      </ul>
                    )}
                    <style jsx global>{`
                      @keyframes fadeInDropdown {
                        from { opacity: 0; transform: translateY(8px); }
                        to { opacity: 1; transform: translateY(0); }
                      }
                    `}</style>
                    <div className="flex flex-col items-end">
                    <Button
                      onClick={handleSendMessage}
                      disabled={isLoading || isStreaming || !selectedConnectionId}
                      className="bg-primary hover:bg-primary/80 text-primary-foreground"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send
                    </Button>
                    {isStreaming && (
                        <Button
                            onClick={handleStopStreaming}
                            variant="destructive"
                            className="mt-2"
                            size="icon"
                            aria-label="Stop Streaming"
                        >
                          <Ban className="w-3 h-3" />
                        </Button>
                    )}
                    </div>
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
            {/* End Chat panel */}
            {/* SQL Result panel and splitter */}
            {showResultPanel && (
              <ResizableSplitter
                onResize={handlePanelResize}
                initialPosition={panelSplit}
                minLeftWidth={20}
                minRightWidth={20}
                className="h-full flex-shrink-0"
              />
            )}
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
