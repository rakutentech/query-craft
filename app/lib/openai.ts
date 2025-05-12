// lib/openai.ts
import { OpenAI } from "openai";
import {AI_PROVIDER_ERROR} from "@/constants/error";

export async function generateOpenAIChatResponse(openaiConfig: any, messages:  OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string> {
    try {
        const apiKey = openaiConfig.mode === "Built-in" ? process.env.OPENAI_API_KEY : openaiConfig.apiKey;
        const endpoint = openaiConfig.mode === "Built-in" ? process.env.OPENAI_ENDPOINT : openaiConfig.endpoint;
        const model = openaiConfig.mode === "Built-in" ? process.env.OPENAI_MODEL : openaiConfig.model;

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: endpoint || 'https://api.openai.com/v1',
            timeout: 6000,
        });

        const response = await openai.chat.completions.create({
            model: model, // Specify the model
            messages: messages, // Pass the messages array
            max_completion_tokens: 1024, // Limit the response length
        });

        // Extract and return the assistant's reply
        return response.choices[0]?.message?.content || 'No response generated.';
    } catch (error) {
        console.error('Error generating chat response:', error);
        throw new Error(`${AI_PROVIDER_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
    }
}