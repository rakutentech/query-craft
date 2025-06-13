import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

        const connectionId = parseInt(params.id);

        const result = await executeQuery("SHOW TABLES;",  connectionId, userId);
        const tables = result.map((row: any) => Object.values(row)[0]);

        return NextResponse.json(tables, { status: 200 });
    } catch (error) {
        console.error('Error fetching tables:', error);

        return NextResponse.json(
            { error: 'Failed to fetch tables', details: (error as Error).message },
            { status: 500 }
        );
    }
}