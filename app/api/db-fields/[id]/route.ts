import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        const userId = process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? (session?.user?.id || 'anonymous') : 'anonymous';

        const connectionId = parseInt(params.id);
        const { searchParams } = new URL(request.url);
        const tableName = searchParams.get('table');

        if (!tableName) {
            return NextResponse.json(
                { error: 'Table name is required' },
                { status: 400 }
            );
        }

        // Use DESCRIBE to get column information
        const result = await executeQuery(`DESCRIBE \`${tableName}\`;`, connectionId, userId);
        const fields = result.map((row: any) => ({
            name: row.Field,
            type: row.Type,
            nullable: row.Null === 'YES',
            key: row.Key,
            default: row.Default,
            extra: row.Extra
        }));

        return NextResponse.json(fields, { status: 200 });
    } catch (error) {
        console.error('Error fetching table fields:', error);

        return NextResponse.json(
            { error: 'Failed to fetch table fields', details: (error as Error).message },
            { status: 500 }
        );
    }
}