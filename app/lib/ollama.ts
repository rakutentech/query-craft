// lib/ollama.ts
import {Message, Ollama} from "ollama";

export async function generateOllamaChatResponse(ollamaConfig: any, messages: Message[]): Promise<string> {
    const { type, endpoint, model, apiKey } = ollamaConfig;

    // Build headers if type is Remote
    const headers = type === "Remote" && apiKey
        ? { Authorization: `Bearer ${apiKey}` }
        : undefined;

    const ollamaClient = new Ollama({
        host: endpoint || 'http://localhost:11434',
        headers, // Add headers if applicable
    });

    if (!ollamaClient || !model) {
        throw new Error("Ollama client is not initialized. Please call initializeOllama first.");
    }

    try {
        const response = await ollamaClient.chat({
            model: model,
            messages: messages,
        });
        return response.message.content;
    } catch (error) {
        console.error("Error calling Ollama:", error);
        throw new Error("Failed to generate response from AI.");
    }
}

export async function getOllamaModelList(endpoint: string): Promise<string[]> {
    const ollamaClient = new Ollama({
        host: endpoint || 'http://localhost:11434',
    });

    try {
        const response = await ollamaClient.list();
        return response.models.map((model: { name: string }) => model.name);
    } catch (error) {
        console.error("Error fetching Ollama model list via SDK:", error);
        throw new Error("Failed to fetch Ollama model list.");
    }
}