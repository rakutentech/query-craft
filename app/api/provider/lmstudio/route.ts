import {NextResponse} from "next/server";
import {generateLMStudioChatResponse, getLMStudioModelList} from "@/app/lib/lm-studio";

export async function POST(req: Request) {
    try {
        const { lmStudioConfig, messages } = await req.json();
        const readableStream = await generateLMStudioChatResponse(lmStudioConfig, messages);
        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Error in LM Studio API route:', error);
        return NextResponse.json({ error: 'Failed to generate response from LM Studio' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
            return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
        }

        const modelList = await getLMStudioModelList(endpoint);
        return NextResponse.json({ models: modelList });
    } catch (error) {
        console.error('Error fetching LM Studio model list:', error);
        return NextResponse.json({ error: 'Failed to fetch LM Studio model list' }, { status: 500 });
    }
}