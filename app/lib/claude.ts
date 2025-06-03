// lib/claude.ts
import { Anthropic, ClientOptions } from '@anthropic-ai/sdk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {AI_PROVIDER_ERROR} from "@/constants/error";

class CustomAnthropic extends Anthropic {
    constructor(options: ClientOptions & { baseUrl?: string }) {
        super({
            ...options,
            baseURL: options.baseUrl || 'https://api.anthropic.com'
        });
    }
}

// Add a sleep utility
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateClaudeChatResponse(claudeConfig: any, systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): Promise<ReadableStream> {
    try {
        const isBuiltIn = claudeConfig.mode === "Built-in";
        const apiKey = isBuiltIn ? process.env.CLAUDE_API_KEY : claudeConfig.apiKey;
        const endpoint = isBuiltIn ? process.env.CLAUDE_ENDPOINT : claudeConfig.endpoint;
        const model = isBuiltIn ? process.env.CLAUDE_MODEL : claudeConfig.model;

        if (!apiKey || !model) {
            throw new Error("Claude configuration is incomplete. Please provide an API key and model.");
        }

        const anthropic = new CustomAnthropic({
            apiKey,
            baseUrl: endpoint,
            timeout: 6000,
            httpAgent: process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : undefined,
        });

        const encoder = new TextEncoder();

        const stream = await anthropic.messages.stream({
            model,
            max_tokens: 10240,
            system: systemPrompt,
            messages: messages,
        });

        return new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
                            controller.enqueue(encoder.encode(chunk.delta.text));
                            // Slow down streaming: 30ms delay per chunk
                            await sleep(30);
                        }
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            }
        });
    } catch (error) {
        console.error("Error calling Claude API:", error);
        throw new Error(`${AI_PROVIDER_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
    }
}