import { NextResponse } from 'next/server';
import { generateOpenAIChatResponse } from '@/app/lib/openai';

export async function POST(req: Request) {
    try {
        const { openaiConfig, messages } = await req.json();
        const response = await generateOpenAIChatResponse(openaiConfig, messages);
        return NextResponse.json({ response });
    } catch (error) {
        console.error('Error in OpenAI API route:', error);
        return NextResponse.json({ error: 'Failed to generate response from OpenAI' }, { status: 500 });
    }
}