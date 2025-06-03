// lib/azure-ai.ts
import OpenAI, { ClientOptions } from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {AI_PROVIDER_ERROR} from "@/constants/error";

const proxyURL = process.env.PROXY_URL!;

// Add a sleep utility
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateAzureChatResponse(
  azureConfig: any,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): Promise<ReadableStream> {
  try {
    const isBuiltIn = azureConfig.mode === "Built-in";
    const apiKey = isBuiltIn ? process.env.AZURE_OPENAI_API_KEY : azureConfig.apiKey;
    const endpoint = isBuiltIn ? process.env.AZURE_OPENAI_ENDPOINT : azureConfig.endpoint;
    const model = isBuiltIn ? process.env.AZURE_OPENAI_DEPLOYMENT_ID : azureConfig.model;
    const apiVersion = isBuiltIn ? process.env.AZURE_OPENAI_API_VERSION : azureConfig.apiVersion;

    let clientOptions: ClientOptions = {
      apiKey: apiKey,
      baseURL: `${endpoint}/openai/deployments/${model}`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
      httpAgent: proxyURL ? new HttpsProxyAgent(proxyURL) : undefined,
      timeout: 6000
    };

    const openai = new OpenAI(clientOptions);

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
    console.dir(error);
    console.error("Error calling Azure OpenAI:", error);
    throw new Error(`${AI_PROVIDER_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
