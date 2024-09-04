// app/api/connections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { testDatabaseConnection, getDatabaseSchema, saveDatabaseConnection, DatabaseConnection } from '@/app/lib/db';

export async function POST(request: NextRequest) {
  try {
    const connection: DatabaseConnection = await request.json();

    // Test the connection
    await testDatabaseConnection(connection);

    // Get the schema
    const schema = await getDatabaseSchema(connection);

    // Save the connection with the schema
    const connectionWithSchema: DatabaseConnection = {
      ...connection,
      schema
    };
    await saveDatabaseConnection(connectionWithSchema);

    return NextResponse.json(
      { 
        message: 'Connection tested and saved successfully', 
        schema 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving connection:', error);
    
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
        message: 'Failed to save connection', 
        error: errorMessage 
      },
      { status: statusCode }
    );
  }
}