// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings, getDatabaseConnections, saveDatabaseConnection, deleteDatabaseConnection, testDatabaseConnection } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

interface DatabaseConnection {
  id?: number;
  projectName: string;
  dbDriver: string;
  dbHost: string;
  dbPort: string;
  dbUsername: string;
  dbPassword: string;
  dbName: string;
  schema: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getSettings(session.user.id);
    const databaseConnections = await getDatabaseConnections(session.user.id);
    return NextResponse.json({ settings, databaseConnections });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { aiSettings, databaseConnections } = data;
    const invalidConnections = databaseConnections.filter((conn: DatabaseConnection) => {
      return !conn.projectName || !conn.dbDriver || !conn.dbHost || !conn.dbPort ||
             !conn.dbUsername || !conn.dbPassword || !conn.dbName;
    });

    if (invalidConnections.length > 0) {
      return NextResponse.json(
        { error: 'One or more database connections are missing required fields' },
        { status: 400 }
      );
    }

    // Save general settings
    await saveSettings({ ...aiSettings, user_id: session.user.id });

    // Save or update database connections
    for (const connection of databaseConnections) {
      await saveDatabaseConnection(connection, session.user.id);
    }

    return NextResponse.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await request.json();
    await deleteDatabaseConnection(id, session.user.id);
    return NextResponse.json({ message: 'Database connection deleted successfully' });
  } catch (error) {
    console.error("Error deleting database connection:", error);
    return NextResponse.json({ error: "Failed to delete database connection" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await request.json();
    const isValid = await testDatabaseConnection(connection);
    if (isValid) {
      return NextResponse.json({ message: 'Database connection is valid' });
    } else {
      return NextResponse.json({ error: 'Database connection is invalid' }, { status: 400 });
    }
  } catch (error) {
    console.error("Error testing database connection:", error);
    return NextResponse.json({ error: "Failed to test database connection" }, { status: 500 });
  }
}