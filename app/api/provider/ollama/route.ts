import { NextResponse } from 'next/server';
import {generateOllamaChatResponse, getOllamaModelList} from '@/app/lib/ollama';

export async function POST(req: Request) {
    try {
        const { ollamaConfig, messages } = await req.json();
        const readableStream = await generateOllamaChatResponse(ollamaConfig, messages);
        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Error in Ollama API route:', error);
        return NextResponse.json({ error: 'Failed to generate response from Ollama' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
            return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
        }

        const modelList = await getOllamaModelList(endpoint);
        return NextResponse.json({ models: modelList });
    } catch (error) {
        console.error('Error fetching Ollama model list:', error);
        return NextResponse.json({ error: 'Failed to fetch Ollama model list' }, { status: 500 });
    }
}