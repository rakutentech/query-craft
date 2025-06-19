import { NextRequest, NextResponse } from 'next/server';
import { generateShareToken, getDb, databaseConfig } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const messageId = parseInt(params.id);

    // Check if a share token already exists for this message
    const db = await getDb();
    let shareToken: string | null = null;
    if (databaseConfig.type === 'mysql') {
      const [rows] = await (db as any).execute('SELECT share_token FROM messages WHERE id = ?', [messageId]);
      if (rows && rows[0] && rows[0].share_token) {
        shareToken = rows[0].share_token;
      }
    } else {
      const row = await (db as any).get('SELECT share_token FROM messages WHERE id = ?', [messageId]);
      if (row && row.share_token) {
        shareToken = row.share_token;
      }
    }
    if (shareToken) {
      return NextResponse.json({ token: shareToken });
    }

    // If not, generate a new one
    const generatedToken = await generateShareToken(messageId);
    return NextResponse.json({ token: generatedToken });
  } catch (error) {
    console.error('Error generating share token:', error);
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
}