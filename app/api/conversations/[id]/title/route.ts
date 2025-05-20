import { NextRequest, NextResponse } from 'next/server';
import { updateConversationTitle } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const conversationId = parseInt(params.id);
    const { title } = await request.json();

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      );
    }

    await updateConversationTitle(conversationId, title);
    return NextResponse.json({ message: 'Title updated successfully' });
  } catch (error) {
    console.error('Error updating conversation title:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation title' },
      { status: 500 }
    );
  }
} 