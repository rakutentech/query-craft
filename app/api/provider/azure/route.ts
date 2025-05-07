import { NextResponse } from 'next/server';
import { generateAzureChatResponse } from '@/app/lib/azure-ai';

export async function POST(req: Request) {
    try {
        const { azureOpenAIConfig, messages } = await req.json();
        const response = await generateAzureChatResponse(azureOpenAIConfig, messages);
        return NextResponse.json({ response });
    } catch (error) {
        console.error('Error in Azure OpenAI API route:', error);
        return NextResponse.json({ error: 'Failed to generate response from Azure OpenAI' }, { status: 500 });
    }
}