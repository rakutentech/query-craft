// app/api/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getConversationByConnectionId, getConversationMessages } from '@/app/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const conversationId = parseInt(params.id);

  try {
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