import { NextRequest, NextResponse } from 'next/server';
import { generateShareToken } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const messageId = parseInt(params.id);

    const shareToken = await generateShareToken(messageId);
    return NextResponse.json({ token: shareToken });
  } catch (error) {
    console.error('Error generating share token:', error);
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
} 