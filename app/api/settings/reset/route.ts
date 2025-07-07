// app/api/settings/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteAllDatabaseConnections } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

    console.log('🗑️ Reset API: Deleting all database connections for user:', userId);
    
    // Delete all existing database connections for this user
    await deleteAllDatabaseConnections(userId);
    
    console.log('✅ Reset API: All database connections deleted successfully');
    
    return NextResponse.json({ 
      message: 'All database connections deleted successfully',
      userId 
    });
  } catch (error) {
    console.error("❌ Reset API Error:", error);
    return NextResponse.json({ 
      error: "Failed to reset database connections",
      details: (error as Error).message 
    }, { status: 500 });
  }
}