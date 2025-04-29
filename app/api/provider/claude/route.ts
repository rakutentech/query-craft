import { NextResponse } from 'next/server';
import { generateClaudeChatResponse } from '@/app/lib/claude';

export async function POST(req: Request) {
    try {
        const { claudeConfig, systemPrompt, messages } = await req.json();
        const response = await generateClaudeChatResponse(claudeConfig, systemPrompt, messages);
        return NextResponse.json({ response });
    } catch (error) {
        console.error('Error in Claude API route:', error);
        return NextResponse.json({ error: 'Failed to generate response from Claude' }, { status: 500 });
    }
}