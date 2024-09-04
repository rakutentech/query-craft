// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { addToHistory, getHistory } from '@/app/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { connectionId, query, sql } = await request.json();

    if (!connectionId || !query || !sql) {
      return NextResponse.json(
        { error: 'Missing required fields: connectionId, query, or sql' },
        { status: 400 }
      );
    }

    await addToHistory(connectionId, query, sql);

    return NextResponse.json(
      { message: 'History saved successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving history:', error);
    
    return NextResponse.json(
      { error: 'Failed to save history', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: connectionId' },
        { status: 400 }
      );
    }

    const history = await getHistory(parseInt(connectionId, 10));

    return NextResponse.json(history, { status: 200 });
  } catch (error) {
    console.error('Error fetching history:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch history', details: (error as Error).message },
      { status: 500 }
    );
  }
}