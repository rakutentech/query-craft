import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import crypto from 'crypto';
import { databaseConfig } from '@/app/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const db = await getDb();
    const { id } = params;

    // Check if the id is a token (32 characters hex) or a numeric ID
    const isToken = /^[0-9a-f]{32}$/i.test(id);
    const query = isToken 
      ? 'SELECT * FROM messages WHERE share_token = ?'
      : 'SELECT * FROM messages WHERE id = ?';
    
    if (databaseConfig.type === 'mysql') {
      const [message] = await (db as any).execute(query, [id]);
      if (!message || message.length === 0) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      return NextResponse.json({
        message: message[0],
        canEdit: userId !== 'anonymous'
      });
    } else {
      const message = await (db as any).get(query, [id]);
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      return NextResponse.json({
        message,
        canEdit: userId !== 'anonymous'
      });
    }
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
  }
}