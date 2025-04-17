// app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getConversations, getConversationByConnectionId } from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    let conversations;
    if (connectionId) {
      conversations = await getConversationByConnectionId(parseInt(connectionId, 10));
    } else {
      conversations = await getConversations();
    }

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}