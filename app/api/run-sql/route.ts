import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/app/lib/db';
import { FieldPacket, QueryError } from 'mysql2';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const { sql, connectionId } = await request.json();
    console.log('Executing SQL:', sql, 'on connection:', connectionId);

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    const result = await executeQuery(sql, connectionId, userId);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error executing SQL:', error);
    return NextResponse.json({ error: 'Failed to execute SQL' }, { status: 500 });
  }
}