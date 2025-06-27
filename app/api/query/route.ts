import { NextRequest, NextResponse } from "next/server";
import {
  addMessage,
  createConversation,
  getConversationMessages,
  updateConversationTitle,
  getSettings,
  getUserConnectionById,
  updateMessageById
} from "@/app/lib/db";
import {Message} from "ollama";
import OpenAI from "openai";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import {Anthropic} from "@anthropic-ai/sdk";
import {generateClaudeChatResponse} from "@/app/lib/claude";
import {generateOpenAIChatResponse} from "@/app/lib/openai";
import {generateLMStudioChatResponse} from "@/app/lib/lm-studio";
import {generateOllamaChatResponse} from "@/app/lib/ollama";
import {generateAzureChatResponse} from "@/app/lib/azure-ai";
import { ChatInput } from "@lmstudio/sdk";
import { v4 as uuidv4 } from 'uuid';

const stopFlags = new Map<number, boolean>();

export async function PUT(request: NextRequest) {
  const { conversationId } = await request.json();
  stopFlags.set(conversationId, true);
  return new Response("OK");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const { query, providerConfig: providerConfig, conversationId, connectionId } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { error: "Connection ID is required" },
        { status: 400 }
      );
    }

    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = await createConversation(
        query.substring(0, 20) + "...",
        connectionId,
        userId
      );
    }

    // Add user message to the conversation with generated UUID
    const userMessageId = await addMessage(currentConversationId, query, "user");

    // Get conversation history
    const conversationHistory = await getConversationMessages(
      currentConversationId
    );

    // Get settings and database connections
    const settings = await getSettings(userId);
    const currentConnection = await getUserConnectionById(connectionId, userId);

    if (!currentConnection) {
      return NextResponse.json(
        { error: "Invalid connection ID" },
        { status: 400 }
      );
    }

    // Combine system prompt with SQL examples and current connection info
    let fullSystemPrompt = settings.systemPrompt;
    if (currentConnection && currentConnection.schema.trim() !== '') {
      fullSystemPrompt += '\n\nHere are the full database schemas for reference:\n' + currentConnection.schema;
    }
    fullSystemPrompt += `\n\nCurrent database connection: ${currentConnection.projectName} (${currentConnection.dbDriver})`;

    let aiResponse;
    let aiStream: ReadableStream;
    let stream;
    const encoder = new TextEncoder();

    // Check providerConfig to determine which provider to use
    switch (providerConfig.selectedProvider) {
      case "Azure OpenAI":
        console.log("Azure OpenAI config", providerConfig.config.azure);
        // Prepare messages for Azure OpenAI
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: fullSystemPrompt },
          ...conversationHistory.map(
              (msg) =>
                  ({
                    role: msg.sender === "user" ? "user" : "assistant",
                    content: msg.content
                  } as OpenAI.Chat.ChatCompletionMessageParam)
          )
        ];

        aiStream = await generateAzureChatResponse(providerConfig.config.azure, messages);
        const systemMessageId1 = uuidv4();
        stream = await createAIStream({
          aiStream,
          encoder,
          currentConversationId,
          conversationId,
          query,
          systemMessageId: systemMessageId1,
          getConversationMessages,
          addMessage,
          updateConversationTitle
        });

        aiResponse = new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
        break;

      case "Ollama":
        console.log("Ollama config", providerConfig.config.ollama);
        let ollamaMessages: Message[] = [
          { role: "system", content: fullSystemPrompt },
          ...conversationHistory.map(
              (msg) =>
                  ({
                    role: msg.sender === "user" ? "user" : "assistant",
                    content: msg.content
                  } as Message)
          )
        ];

        aiStream = await generateOllamaChatResponse(providerConfig.config.ollama, ollamaMessages);
        const systemMessageId2 = uuidv4();
        stream = await createAIStream({
          aiStream,
          encoder,
          currentConversationId,
          conversationId,
          query,
          systemMessageId: systemMessageId2,
          getConversationMessages,
          addMessage,
          updateConversationTitle
        });

        aiResponse = new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
        break;

      case "LM Studio":
        console.log("LM Studio config", providerConfig.config.lmStudio);
        // Prepare messages for LM Studio
        const lmStudioMessages = [
          { role: "system", content: fullSystemPrompt },
          ...conversationHistory.map(
              (msg) =>
                  ({
                    role: msg.sender === "user" ? "user" : "assistant",
                    content: msg.content
                  })
          )
        ];
        // Generate response from LM Studio
        aiStream = await generateLMStudioChatResponse(providerConfig.config.lmStudio, lmStudioMessages as ChatInput);
        const systemMessageId3 = uuidv4();
        stream = await createAIStream({
          aiStream,
          encoder,
          currentConversationId,
          conversationId,
          query,
          systemMessageId: systemMessageId3,
          getConversationMessages,
          addMessage,
          updateConversationTitle
        });

        aiResponse = new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
        break;
      case "Claude":
        console.log("Claude config", providerConfig.config.claude);
        // Prepare messages for Claude
        const claudeMessages = [
          ...conversationHistory.map(
              (msg) =>
                  ({
                    role: msg.sender === "user" ? "user" : "assistant",
                    content: msg.content
                  } as Anthropic.Messages.MessageParam)
          )
        ];
        // // Generate response from Claude
        aiStream = await generateClaudeChatResponse(providerConfig.config.claude, fullSystemPrompt, claudeMessages);
        const systemMessageId4 = uuidv4();
        stream = await createAIStream({
          aiStream,
          encoder,
          currentConversationId,
          conversationId,
          query,
          systemMessageId: systemMessageId4,
          getConversationMessages,
          addMessage,
          updateConversationTitle
        });

        aiResponse = new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
        break;
      case "OpenAI":
        console.log("OpenAI config", providerConfig.config.openai);
        // Prepare messages for OpenAI
        const systemMessageParam: OpenAI.Chat.Completions.ChatCompletionSystemMessageParam = {
          role: "system",
          content: fullSystemPrompt,
        };

        const openaiMessages = [
          systemMessageParam,
          ...conversationHistory.map((msg) =>
              msg.sender === "user"
                  ? ({
                    role: "user",
                    content: msg.content,
                  } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam)
                  : ({
                    role: "assistant",
                    content: msg.content,
                  } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam)
          ),
        ];

        aiStream = await generateOpenAIChatResponse(providerConfig.config.openai, openaiMessages);
        const systemMessageId5 = uuidv4();
        stream = await createAIStream({
          aiStream,
          encoder,
          currentConversationId,
          conversationId,
          query,
          systemMessageId: systemMessageId5,
          getConversationMessages,
          addMessage,
          updateConversationTitle
        });

        aiResponse = new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
        break;
      default:
        console.error("Unsupported provider");
        return NextResponse.json(
            { error: "Unsupported provider" },
            { status: 400 }
        );
    }

    return aiResponse;
  } catch (error: unknown) {
    console.error("Error processing query:", error);
    let errorMessage = "An unknown error occurred";
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific error types
      if (errorMessage.includes("Connection ID is required") || 
          errorMessage.includes("Invalid connection ID")) {
        statusCode = 400;
      } else if (errorMessage.includes("Database connection not found")) {
        statusCode = 404;
      }
    }

    return NextResponse.json(
      { error: "Failed to process query", message: errorMessage },
      { status: statusCode }
    );
  }
}

async function createAIStream({
                                aiStream,
                                encoder,
                                currentConversationId,
                                conversationId,
                                query,
                                systemMessageId,
                                getConversationMessages,
                                addMessage,
                                updateConversationTitle
                              }: {
  aiStream: ReadableStream;
  encoder: TextEncoder;
  currentConversationId: number;
  conversationId: number | undefined;
  query: string;
  systemMessageId: string;
  getConversationMessages: (id: number) => Promise<any>;
  addMessage: (id: number, content: string, sender: "user" | "system", messageId?: string) => Promise<string>;
  updateConversationTitle: (id: number, title: string) => Promise<void>;
}) {
  let accumulated = "";
  let messageCreated = false;

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`event:meta\ndata:${JSON.stringify({
        conversationId: currentConversationId,
        conversationHistory: await getConversationMessages(currentConversationId)
      })}\n\n`));

      const reader = aiStream.getReader();
      let stopped = false;
      try {
        while (true) {
          if (stopFlags.get(currentConversationId)) {
            stopped = true;
            break;
          }
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = typeof value === "string" ? value : new TextDecoder().decode(value);
          accumulated += chunk;
          
          // Create the message in database as soon as we have some content
          if (!messageCreated && accumulated.trim().length > 0) {
            await addMessage(currentConversationId, accumulated, "system", systemMessageId);
            messageCreated = true;
          }
          
          controller.enqueue(typeof value === "string" ? encoder.encode(value) : value);
        }
      } finally {
        controller.close();
        // Update the message with final content if it was created, otherwise create it
        if (messageCreated) {
          // Update the existing message with final content
          await updateMessageById(systemMessageId, accumulated);
        } else {
          // Create the message if no content was streamed
          await addMessage(currentConversationId, accumulated, "system", systemMessageId);
        }
        
        if (!conversationId) {
          await updateConversationTitle(currentConversationId, query.substring(0, 50) + "...");
        }
        if (stopped) {
          console.log("Stream stopped by user.");
        }
        stopFlags.delete(currentConversationId)
      }
    }
  });
}