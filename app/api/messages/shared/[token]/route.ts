import { NextRequest, NextResponse } from 'next/server';
import { getSharedMessage, updateSharedMessage } from '@/app/lib/db';
import { getToken } from 'next-auth/jwt';

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = await getToken({ req: request });
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (token?.sub || 'anonymous') : 'anonymous';

    const { token: messageToken } = params;
    const result = await getSharedMessage(messageToken);
    if (!result) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({
      ...result,
      canEdit: userId !== 'anonymous'
    });
  } catch (error) {
    console.error('Error fetching shared message:', error);
    return NextResponse.json({ error: 'Failed to fetch shared message' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = await getToken({ req: request });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token: messageToken } = params;
    const { content } = await request.json();

    await updateSharedMessage(messageToken, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating shared message:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
} 