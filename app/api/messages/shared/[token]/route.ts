import { NextRequest, NextResponse } from 'next/server';
import { checkUserSession } from '@/app/lib/auth';
import { getSharedMessage, updateSharedMessage } from '@/app/lib/db';

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params;
  const { isAuthenticated } = await checkUserSession();

  try {
    const result = await getSharedMessage(token);
    if (!result) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({
      ...result,
      canEdit: isAuthenticated
    });
  } catch (error) {
    console.error('Error fetching shared message:', error);
    return NextResponse.json({ error: 'Failed to fetch shared message' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const { isAuthenticated } = await checkUserSession();
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = params;
  const { content } = await request.json();

  try {
    await updateSharedMessage(token, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating shared message:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
} 