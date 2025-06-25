import { NextRequest, NextResponse } from 'next/server';
import { generateShareToken } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const messageId = parseInt(params.id);
    
    // Validate messageId
    if (isNaN(messageId) || messageId <= 0) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    const shareToken = await generateShareToken(messageId);
    return NextResponse.json({ token: shareToken });
  } catch (error) {
    console.error('Error generating share token:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'Message not found') {
        return NextResponse.json({ error: 'Message not found or has been deleted' }, { status: 404 });
      }
      if (error.message.includes('Failed to update share token')) {
        return NextResponse.json({ error: 'Unable to create share link for this message' }, { status: 500 });
      }
    }
    
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
}