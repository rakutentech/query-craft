import { NextRequest, NextResponse } from 'next/server';
import { generateShareToken } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const messageId = params.id;
    
    // Validate messageId (should be a valid UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!messageId || !uuidRegex.test(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID format' }, { status: 400 });
    }

    // Retry mechanism for recently created messages
    let shareToken;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // Add a small delay to allow for any pending database operations to complete
        if (attempts > 0) {
          await new Promise(resolve => setTimeout(resolve, 200 * attempts));
        }
        
        shareToken = await generateShareToken(messageId);
        break;
      } catch (error) {
        attempts++;
        if (error instanceof Error && error.message === 'Message not found' && attempts < maxAttempts) {
          // Wait a bit longer for the message to be saved
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json({ token: shareToken });
  } catch (error) {
    console.error('Error generating share token:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'Message not found') {
        return NextResponse.json({
          error: 'Message not found. Please wait a moment for the message to be saved and try again.'
        }, { status: 404 });
      }
      if (error.message.includes('Failed to update share token')) {
        return NextResponse.json({ error: 'Unable to create share link for this message' }, { status: 500 });
      }
    }
    
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
}