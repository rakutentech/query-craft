import { NextRequest, NextResponse } from "next/server";
import {
  executeQuery,
  addMessage,
  createConversation,
  getConversationMessages,
  updateConversationTitle,
  getSettings,
  getDatabaseConnections
} from "@/app/lib/db";
import { generateChatResponse } from "@/app/lib/azure-ai";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const { query, conversationId, connectionId } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { error: "Connection ID is required" },
        { status: 400 }
      );
    }

    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = await createConversation(
        query.substring(0, 50) + "...",
        connectionId
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
    const connections = await getDatabaseConnections();
    const currentConnection = connections.find(conn => conn.id === connectionId);

    if (!currentConnection) {
      return NextResponse.json(
        { error: "Invalid connection ID" },
        { status: 400 }
      );
    }

    // Combine system prompt with SQL examples and current connection info
    let fullSystemPrompt = settings.systemPrompt;
    if (currentConnection && currentConnection.schema.trim() !== '') {
      fullSystemPrompt += '\n\nHere are some example SQL queries for reference:\n' + currentConnection.schema;
    }
    fullSystemPrompt += `\n\nCurrent database connection: ${currentConnection.projectName} (${currentConnection.dbDriver})`;

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
    const aiResponse = await generateChatResponse(messages);

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
      { error: "Failed to process query", details: errorMessage },
      { status: statusCode }
    );
  }
}