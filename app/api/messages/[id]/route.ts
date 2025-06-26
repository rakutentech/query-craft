import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getMessageById, updateMessageById } from '@/app/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';
    const { id } = params;
    const messageId = id;
    
    // Validate messageId (should be a valid UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!messageId || !uuidRegex.test(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID format' }, { status: 400 });
    }
    
    const message = await getMessageById(messageId);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({
      message,
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';
    const { id } = params;
    const messageId = id;
    
    // Validate messageId (should be a valid UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!messageId || !uuidRegex.test(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID format' }, { status: 400 });
    }
    
    const { content} = await request.json();
    try {
      if (content) {
        // Update message content
        await updateMessageById(messageId, content); // This will update the content for the message
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