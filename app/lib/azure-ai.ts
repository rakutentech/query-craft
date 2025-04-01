// lib/azure-ai.ts
import OpenAI, { ClientOptions } from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';

const azureApiKey = process.env.AZURE_OPENAI_API_KEY!;
const azureBaseUrl = process.env.AZURE_OPENAI_ENDPOINT!;
const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_ID!;
const apiVersion = process.env.AZURE_API_VERSION!;
const proxyURL = process.env.PROXY_URL!;

let clientOptions: ClientOptions = {
  apiKey: azureApiKey,
  baseURL: `${azureBaseUrl}/openai/deployments/${azureDeploymentName}`,
  defaultQuery: { 'api-version': apiVersion || '2024-06-01' },
  defaultHeaders: { 'api-key': azureApiKey },
  httpAgent: proxyURL ? new HttpsProxyAgent(proxyURL) : undefined,
  timeout: 3000
}

const openai = new OpenAI(clientOptions);

export async function generateChatResponse(messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: azureDeploymentName,
      messages: messages,
    });

    return completion.choices[0]?.message?.content || "No response generated.";
  } catch (error) {
    console.dir(error)
    console.error("Error calling Azure OpenAI:", error);
    throw new Error("Failed to generate response from AI.");
  }
}