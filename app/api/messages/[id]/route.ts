import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import crypto from 'crypto';
import { databaseConfig } from '@/app/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const db = await getDb();
  const { id } = params;

  try {
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
        canEdit: !!session?.user?.id
      });
    } else {
      const message = await (db as any).get(query, [id]);
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      return NextResponse.json({
        message,
        canEdit: !!session?.user?.id
      });
    }
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const { content, generateShareToken } = await request.json();

  try {
    const db = await getDb();
    
    if (generateShareToken) {
      // Generate a new share token
      const shareToken = crypto.randomBytes(16).toString('hex');
      if (databaseConfig.type === 'mysql') {
        await (db as any).execute(
          'UPDATE messages SET share_token = ? WHERE id = ?',
          [shareToken, id]
        );
      } else {
        await (db as any).run(
          'UPDATE messages SET share_token = ? WHERE id = ?',
          [shareToken, id]
        );
      }
      return NextResponse.json({ token: shareToken });
    } else if (content) {
      // Update message content
      const isToken = /^[0-9a-f]{32}$/i.test(id);
      const query = isToken
        ? 'UPDATE messages SET content = ? WHERE share_token = ?'
        : 'UPDATE messages SET content = ? WHERE id = ?';

      if (databaseConfig.type === 'mysql') {
        await (db as any).execute(query, [content, id]);
      } else {
        await (db as any).run(query, [content, id]);
      }
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
} 