// lib/claude.ts
import { Anthropic, ClientOptions } from '@anthropic-ai/sdk';

class CustomAnthropic extends Anthropic {
    constructor(options: ClientOptions & { baseUrl?: string }) {
        super({
            ...options,
            baseURL: options.baseUrl || 'https://api.anthropic.com'
        });
    }
}

export async function generateClaudeChatResponse(claudeConfig: any, systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): Promise<string> {
    const apiKey = claudeConfig.mode === "Built-in" ? process.env.CLAUDE_API_KEY : claudeConfig.apiKey;
    const endpoint = claudeConfig.mode === "Built-in" ? process.env.CLAUDE_ENDPOINT : claudeConfig.endpoint;
    const model = claudeConfig.mode === "Built-in" ? process.env.CLAUDE_MODEL : claudeConfig.model;

    if (!apiKey || !model) {
        throw new Error("Claude configuration is incomplete. Please provide an API key and model.");
    }

    const anthropic = new CustomAnthropic({
        apiKey,
        baseUrl: endpoint
    });

    try {
        const response = await anthropic.messages.create({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages,
        });

        return response.content.filter(block => block.type === "text")
            .map(block => block.text)
            .join("");
    } catch (error) {
        console.error("Error calling Claude API:", error);
        throw new Error("Failed to generate response from Claude.");
    }
}