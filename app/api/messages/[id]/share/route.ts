import { NextRequest, NextResponse } from 'next/server';
import { checkUserSession } from '@/app/lib/auth';
import { generateShareToken } from '@/app/lib/db';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { isAuthenticated } = await checkUserSession();
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const messageId = parseInt(params.id);

  try {
    const shareToken = await generateShareToken(messageId);
    return NextResponse.json({ token: shareToken });
  } catch (error) {
    console.error('Error generating share token:', error);
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
} 