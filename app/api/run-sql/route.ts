import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/app/lib/db';
import { FieldPacket, QueryError } from 'mysql2';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sql, connectionId } = await request.json();
    console.log('Executing SQL:', sql, 'on connection:', connectionId);

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    const result = await executeQuery(sql, connectionId, session.user.id);
    return NextResponse.json({ result });
  } catch (error: unknown) {
    console.error('Error executing SQL query:', error);
    
    let errorMessage = 'An unknown error occurred';
    let errorDetails = {};
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
      
      // Check if it's a MySQL error
      if ('code' in error && typeof (error as any).code === 'string') {
        const mysqlError = error as QueryError;
        errorMessage = 'Database error occurred';
        errorDetails = {
          code: mysqlError.code,
          sqlMessage: mysqlError.message,
          sqlState: mysqlError.sqlState,
        };
        statusCode = 400; // Bad Request for database errors
      }

      // Check for connection-related errors
      if (errorMessage.includes('Database connection not found')) {
        statusCode = 404; // Not Found for invalid connection ID
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to execute SQL query', 
        message: errorMessage,
        details: errorDetails,
      },
      { status: statusCode }
    );
  }
}