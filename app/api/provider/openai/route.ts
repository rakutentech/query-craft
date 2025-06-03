import { NextResponse } from 'next/server';
import { generateOpenAIChatResponse } from '@/app/lib/openai';

export async function POST(req: Request) {
    try {
        const { openaiConfig, messages } = await req.json();
        const readableStream = await generateOpenAIChatResponse(openaiConfig, messages);
        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Error in OpenAI API route:', error);
        return NextResponse.json({ error: 'Failed to generate response from OpenAI' }, { status: 500 });
    }
}