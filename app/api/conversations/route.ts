// app/api/conversations/[id]/route.ts
import { NextResponse } from 'next/server';
import { getConversations } from '@/app/lib/db';

export async function GET() {

  try {
    const conversations = await getConversations();
    return NextResponse.json({ conversations: conversations });
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation messages' }, { status: 500 });
  }
}