// app/api/connections/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteDatabaseConnection } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid connection ID' }, { status: 400 });
  }

  try {
    await deleteDatabaseConnection(id, session.user.id);
    return NextResponse.json({ message: 'Connection deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete connection', details: (error as Error).message },
      { status: 500 }
    );
  }
}