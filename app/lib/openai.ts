// lib/openai.ts
import { OpenAI } from "openai";
import {AI_PROVIDER_ERROR} from "@/constants/error";

// Add a sleep utility
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateOpenAIChatResponse(openaiConfig: any, messages:  OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<ReadableStream> {
    try {
        const isBuiltIn = openaiConfig.mode === "Built-in";
        const apiKey = isBuiltIn ? process.env.OPENAI_API_KEY : openaiConfig.apiKey;
        const endpoint = isBuiltIn ? process.env.OPENAI_ENDPOINT : openaiConfig.endpoint;
        const model = isBuiltIn ? process.env.OPENAI_MODEL : openaiConfig.model;

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: endpoint || 'https://api.openai.com/v1',
            timeout: 6000,
            httpAgent: process.env.PROXY_URL ? new URL(process.env.PROXY_URL) : undefined,
        });

        const streamResponse = await openai.chat.completions.create({
            model: model,
            messages: messages,
            stream: true,
        });

        const encoder = new TextEncoder();

        return new ReadableStream({
            async start(controller) {
                for await (const chunk of streamResponse) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    controller.enqueue(encoder.encode(content));
                    // Slow down streaming: 30ms delay per chunk
                    await sleep(30);
                }
                controller.close();
            },
        });
    } catch (error) {
        console.error('Error generating chat response:', error);
        throw new Error(`${AI_PROVIDER_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
    }
}