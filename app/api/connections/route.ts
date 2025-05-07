// app/api/connections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { testDatabaseConnection, getDatabaseSchema, saveDatabaseConnection, DatabaseConnection } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    const connection: DatabaseConnection = await request.json();

    // Test the connection
    await testDatabaseConnection(connection);

    // Get the schema
    const schema = await getDatabaseSchema(connection);

    return NextResponse.json(
      { 
        message: 'Connection tested successfully', 
        schema 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error testing connection:', error);
    
    let statusCode = 500;
    let errorMessage = 'An unexpected error occurred';

    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Determine more specific status codes based on the error
      if (errorMessage.includes('Connection refused') || errorMessage.includes('Unable to connect')) {
        statusCode = 503; // Service Unavailable
      } else if (errorMessage.includes('Access denied') || errorMessage.includes('Authentication failed')) {
        statusCode = 401; // Unauthorized
      } else if (errorMessage.includes('Database not found')) {
        statusCode = 404; // Not Found
      }
    }

    return NextResponse.json(
      { 
        message: 'Failed to test connection', 
        error: errorMessage 
      },
      { status: statusCode }
    );
  }
}