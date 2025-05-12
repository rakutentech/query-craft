import { NextRequest, NextResponse } from "next/server";
import {
  executeQuery,
  addMessage,
  createConversation,
  getConversationMessages,
  updateConversationTitle,
  getSettings,
  getUserConnectionById
} from "@/app/lib/db";
import {Message} from "ollama";
import {generateOllamaChatResponse} from "@/app/lib/ollama";
import {generateAzureChatResponse} from "@/app/lib/azure-ai";
import OpenAI from "openai";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import {Anthropic} from "@anthropic-ai/sdk";
import {generateClaudeChatResponse} from "@/app/lib/claude";
import {generateOpenAIChatResponse} from "@/app/lib/openai";
import {generateLMStudioChatResponse} from "@/app/lib/lm-studio";
import {Chat, ChatInput, ChatMessageInput} from "@lmstudio/sdk";

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

    // Add user message to the conversation
    await addMessage(currentConversationId, query, "user");

    // Get conversation history
    const conversationHistory = await getConversationMessages(
      currentConversationId
    );

    // Get settings and database connections
    const settings = await getSettings();
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
        // Generate response from Azure OpenAI
        aiResponse = await generateAzureChatResponse(providerConfig.config.azure, messages);
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

        aiResponse = await generateOllamaChatResponse(providerConfig.config.ollama, ollamaMessages);
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
        aiResponse = await generateLMStudioChatResponse(providerConfig.config.lmStudio, lmStudioMessages as ChatInput);
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
        // Generate response from Claude
        aiResponse = await generateClaudeChatResponse(providerConfig.config.claude, fullSystemPrompt, claudeMessages);
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
        // Generate response from OpenAI
        aiResponse = await generateOpenAIChatResponse(providerConfig.config.openai, openaiMessages);
        break;
      default:
        console.error("Unsupported provider");
        return NextResponse.json(
            { error: "Unsupported provider" },
            { status: 400 }
        );
    }

    // Add AI response to the conversation
    await addMessage(currentConversationId, aiResponse, "system");

    // Update conversation title if it's a new conversation
    if (!conversationId) {
      await updateConversationTitle(
        currentConversationId,
        query.substring(0, 50) + "..."
      );
    }

    // Get updated conversation history
    const updatedConversationHistory = await getConversationMessages(
      currentConversationId
    );

    return NextResponse.json({
      result: aiResponse,
      conversationId: currentConversationId,
      conversationHistory: updatedConversationHistory
    });
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