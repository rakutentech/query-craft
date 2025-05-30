// lib/ollama.ts
import {Message, Ollama} from "ollama";
import {AI_PROVIDER_ERROR} from "@/constants/error";

// Add a sleep utility
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateOllamaChatResponse(ollamaConfig: any, messages: Message[]): Promise<ReadableStream> {
    try {
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

        const encoder = new TextEncoder();

        // Create a ReadableStream wrapper
        return new ReadableStream({
            async start(controller) {
                try {
                    const chatStream = await ollamaClient.chat({
                        model,
                        messages,
                        stream: true
                    });

                    for await (const chunk of chatStream) {
                        if (chunk.message?.content) {
                            // Encode and stream content tokens
                            controller.enqueue(encoder.encode(chunk.message.content));
                            // Slow down streaming: 30ms delay per chunk
                            await sleep(30);
                        }
                    }

                    controller.close();
                } catch (error) {
                    console.error('Stream error:', error);
                    controller.enqueue(encoder.encode("\n\n⚠️ Streaming error occurred"));
                    controller.close();
                }
            },
            cancel() {
                // Handle stream cancellation
                console.log('Stream cancelled by client');
            }
        });
    } catch (error) {
        console.error("Error calling Ollama:", error);
        throw new Error(`${AI_PROVIDER_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
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