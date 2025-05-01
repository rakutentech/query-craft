// File: `app/lib/lm-studio.ts`
import {ChatInput, LMStudioClient} from "@lmstudio/sdk";


export async function generateLMStudioChatResponse(lmStudioConfig: any, message: ChatInput): Promise<string> {
    const { endpoint, model } = lmStudioConfig;
    const wsEndpoint = endpoint.replace(/^http/, 'ws');

    if (!wsEndpoint || !model) {
        throw new Error("LM Studio configuration is incomplete. Please provide both endpoint and model.");
    }

    const lmStudioClient = new LMStudioClient({
        baseUrl: wsEndpoint,
    });

    const lmModel = await lmStudioClient.llm.model(model);

    if (!lmModel) {
        throw new Error(`LM Studio model ${model} not found.`);
    }

    try {
        const response = await lmModel.respond(message);

        return response.content;
    } catch (error) {
        console.error("Error calling LM Studio:", error);
        throw new Error("Failed to generate response from LM Studio.");
    }
}

export async function getLMStudioModelList(endpoint: string): Promise<string[]> {
    const wsEndpoint = endpoint.replace(/^http/, 'ws');
    const lmStudioClient = new LMStudioClient({
        baseUrl: wsEndpoint,
    });

    try {
        const models = await lmStudioClient.system.listDownloadedModels();
        console.log("LM Studio models fetched:", models);
        return models
            .filter((model: { type: string }) => model.type === 'llm')
            .map((model: { modelKey: string }) => model.modelKey);
    } catch (error) {
        console.error("Error fetching LM Studio model list via SDK:", error);
        throw new Error("Failed to fetch LM Studio model list.");
    }
}