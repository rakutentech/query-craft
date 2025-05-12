import { NextRequest, NextResponse } from "next/server";
import { getDatabaseConnections, executeQuery } from '@/app/lib/db';

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

    const connId = parseInt(connectionId, 10);

    const connections = await getDatabaseConnections();
    const currentConnection = connections.find(conn => conn.id === connId);

    if (!currentConnection) {
        return NextResponse.json(
        { error: "Invalid connection ID" },
        { status: 400 }
        );
    }
    // const tables = await getTablesList(currentConnection);
    const result = await executeQuery("SHOW TABLES;", connId);
    const tables = result.map((row: any) => Object.values(row)[0]);

    return NextResponse.json(tables, { status: 200 });
  } catch (error) {
    console.error('Error fetching history:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch history', details: (error as Error).message },
      { status: 500 }
    );
  }
}