// File: `app/lib/lm-studio.ts`
import {ChatInput, LMStudioClient} from "@lmstudio/sdk";
import {AI_PROVIDER_ERROR} from "@/constants/error";

// Add a sleep utility
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateLMStudioChatResponse(lmStudioConfig: any, message: ChatInput): Promise<ReadableStream> {
    try{
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

        const prediction = lmModel.respond(message);

        const encoder = new TextEncoder();

        // Create ReadableStream
        return new ReadableStream({
            async start(controller) {
                try {
                    // Process each chunk
                    for await (const { content } of prediction) {
                        controller.enqueue(encoder.encode(content));
                        // Slow down streaming: 30ms delay per chunk
                        await sleep(30);
                    }

                    controller.close();
                } catch (error) {
                    console.error('Stream error:', error);
                    controller.enqueue(encoder.encode('\n\n⚠️ Error in streaming response'));
                    controller.close();
                }
            },
            cancel() {
                // Handle client-side cancellation
                console.log('Stream cancelled by client');
            }
        });
    } catch (error) {
        console.error("Error calling LM Studio:", error);
        throw new Error(`${AI_PROVIDER_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
    }

}

export async function getLMStudioModelList(endpoint: string): Promise<string[]> {
    const wsEndpoint = endpoint.replace(/^http/, 'ws');
    const lmStudioClient = new LMStudioClient({
        baseUrl: wsEndpoint,
    });

    try {
        const models = await lmStudioClient.system.listDownloadedModels();
        return models
            .filter((model: { type: string }) => model.type === 'llm')
            .map((model: { modelKey: string }) => model.modelKey);
    } catch (error) {
        console.error("Error fetching LM Studio model list via SDK:", error);
        throw new Error("Failed to fetch LM Studio model list.");
    }
}