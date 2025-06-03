import {NextRequest, NextResponse} from 'next/server';
import {executeQueryStream} from '@/app/lib/db';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/lib/auth';

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

    return await executeQueryStream(sql, connectionId, userId);
  } catch (error) {
    console.error('Error executing SQL:', error);
    return NextResponse.json(
        { error: `Failed to execute SQL: ${error instanceof Error ? error.message : String(error)}` },
        { status: 500 });
  }
}