import { NextResponse } from 'next/server';
import { generateClaudeChatResponse } from '@/app/lib/claude';

export async function POST(req: Request) {
    try {
        const { claudeConfig, systemPrompt, messages } = await req.json();
        const readableStream = await generateClaudeChatResponse(claudeConfig, systemPrompt, messages);
        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Error in Claude API route:', error);
        return NextResponse.json({ error: 'Failed to generate response from Claude' }, { status: 500 });
    }
}