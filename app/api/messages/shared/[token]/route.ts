import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { databaseConfig, getSharedMessage, updateSharedMessage } from '@/app/lib/db';

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';
    const { token } = params;
    const result = await getSharedMessage(token);
    const message = result?.message;
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({
      message,
      canEdit: userId !== 'anonymous'
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';
    const { token } = params;
    const { content} = await request.json();
    try {
      if (content) {
        // Update message content
        await updateSharedMessage(token, content); // This will update the content for the message
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      }
    } catch (error) {
      console.error('Error updating message:', error);
      return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}