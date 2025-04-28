// app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getConversations, getConversationByConnectionId } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { connectionId } = await request.json();

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