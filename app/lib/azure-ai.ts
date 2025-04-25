// lib/azure-ai.ts
import OpenAI, { ClientOptions } from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyURL = process.env.PROXY_URL!;

export async function generateAzureChatResponse(azureConfig: any, messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  try {
    let clientOptions: ClientOptions = {
      apiKey: azureConfig.apiKey,
      baseURL: `${azureConfig.endpoint}/openai/deployments/${azureConfig.model}`,
      defaultQuery: { 'api-version': azureConfig.apiVersion || '2024-06-01' },
      defaultHeaders: { 'api-key': azureConfig.apiKey },
      httpAgent: proxyURL ? new HttpsProxyAgent(proxyURL) : undefined,
      timeout: 6000
    }

    const openai = new OpenAI(clientOptions);

    const completion = await openai.chat.completions.create({
      model: azureConfig.model,
      messages: messages,
    });

    return completion.choices[0]?.message?.content || "No response generated.";
  } catch (error) {
    console.dir(error)
    console.error("Error calling Azure OpenAI:", error);
    throw new Error("Failed to generate response from AI.");
  }
}