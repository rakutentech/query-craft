// lib/azure-ai.ts
import OpenAI, { ClientOptions } from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyURL = process.env.PROXY_URL!;

export async function generateAzureChatResponse(azureConfig: any, messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  try {
    const apiKey = azureConfig.mode === "Built-in" ? process.env.AZURE_OPENAI_API_KEY : azureConfig.apiKey;
    const endpoint = azureConfig.mode === "Built-in" ? process.env.AZURE_OPENAI_ENDPOINT : azureConfig.endpoint;
    const model = azureConfig.mode === "Built-in" ? process.env.AZURE_OPENAI_DEPLOYMENT_ID : azureConfig.model;
    const apiVersion = azureConfig.mode === "Built-in" ? process.env.AZURE_OPENAI_API_VERSION : azureConfig.apiVersion;

    let clientOptions: ClientOptions = {
      apiKey: apiKey,
      baseURL: `${endpoint}/openai/deployments/${model}`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
      httpAgent: proxyURL ? new HttpsProxyAgent(proxyURL) : undefined,
      timeout: 6000
    }

    const openai = new OpenAI(clientOptions);

    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages,
    });

    return completion.choices[0]?.message?.content || "No response generated.";
  } catch (error) {
    console.dir(error)
    console.error("Error calling Azure OpenAI:", error);
    throw new Error("Failed to generate response from AI.");
  }
}