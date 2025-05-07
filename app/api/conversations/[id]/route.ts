// app/api/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getConversationByConnectionId, getConversationMessages } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const conversationId = parseInt(params.id);

    const messages = await getConversationMessages(conversationId);
    const processedMessages = messages.map(msg => {
      if (msg.sender === 'system' && msg.content.startsWith('```sql')) {
        const sqlContent = msg.content.replace('```sql', '').replace('```', '').trim();
        return { ...msg, sql: sqlContent };
      }
      return msg;
    });
    return NextResponse.json({ messages: processedMessages });
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation messages' }, { status: 500 });
  }
}