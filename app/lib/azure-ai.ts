// lib/azure-ai.ts
import OpenAI from 'openai';

const azureApiKey = process.env.AZURE_OPENAI_API_KEY!;
const azureBaseUrl = process.env.AZURE_OPENAI_ENDPOINT!;
const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_ID!;

const openai = new OpenAI({
  apiKey: azureApiKey,
  baseURL: `${azureBaseUrl}/openai/deployments/${azureDeploymentName}`,
  defaultQuery: { 'api-version': '2023-05-15' },
  defaultHeaders: { 'api-key': azureApiKey },
});

export async function generateChatResponse(messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: azureDeploymentName,
      messages: messages,
    });

    return completion.choices[0]?.message?.content || "No response generated.";
  } catch (error) {
    console.error("Error calling Azure OpenAI:", error);
    throw new Error("Failed to generate response from AI.");
  }
}