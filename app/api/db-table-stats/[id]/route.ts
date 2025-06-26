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

        // Get table statistics
        const stats: any = {
            recordCount: null,
            estimatedRows: null,
            dataLength: null,
            indexLength: null,
            createTime: null,
            updateTime: null,
            comment: null
        };

        try {
            // Get record count
            const countResult = await executeQuery(`SELECT COUNT(*) as count FROM \`${tableName}\`;`, connectionId, userId);
            const count = countResult[0]?.count;
            stats.recordCount = (count !== null && count !== undefined) ? Number(count) : null;
        } catch (error) {
            console.warn(`Could not get record count for table ${tableName}:`, error);
            stats.recordCount = null;
        }

        try {
            // Get table information from INFORMATION_SCHEMA
            const tableInfoResult = await executeQuery(`
                SELECT
                    TABLE_ROWS,
                    DATA_LENGTH,
                    INDEX_LENGTH,
                    CREATE_TIME,
                    UPDATE_TIME,
                    TABLE_COMMENT
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = '${tableName}';
            `, connectionId, userId);

            if (tableInfoResult.length > 0) {
                const info = tableInfoResult[0];
                stats.estimatedRows = (info.TABLE_ROWS !== null && info.TABLE_ROWS !== undefined) ? Number(info.TABLE_ROWS) : null;
                stats.dataLength = (info.DATA_LENGTH !== null && info.DATA_LENGTH !== undefined) ? Number(info.DATA_LENGTH) : null;
                stats.indexLength = (info.INDEX_LENGTH !== null && info.INDEX_LENGTH !== undefined) ? Number(info.INDEX_LENGTH) : null;
                stats.createTime = info.CREATE_TIME || null;
                stats.updateTime = info.UPDATE_TIME || null;
                stats.comment = info.TABLE_COMMENT || null;
                
                // Debug logging
                console.log(`Table ${tableName} stats:`, {
                    updateTime: stats.updateTime,
                    createTime: stats.createTime,
                    dataLength: stats.dataLength,
                    tableRows: stats.estimatedRows
                });
            }
        } catch (error) {
            console.warn(`Could not get table info for table ${tableName}:`, error);
        }

        // If UPDATE_TIME is not available, try to get it from table status
        if (!stats.updateTime) {
            try {
                const statusResult = await executeQuery(`SHOW TABLE STATUS LIKE '${tableName}';`, connectionId, userId);
                if (statusResult.length > 0) {
                    const status = statusResult[0];
                    stats.updateTime = status.Update_time || null;
                    stats.createTime = stats.createTime || status.Create_time || null;
                    stats.dataLength = stats.dataLength || (status.Data_length ? Number(status.Data_length) : null);
                    stats.estimatedRows = stats.estimatedRows || (status.Rows ? Number(status.Rows) : null);
                    
                    console.log(`Table ${tableName} status:`, {
                        updateTime: stats.updateTime,
                        createTime: stats.createTime,
                        dataLength: stats.dataLength,
                        rows: stats.estimatedRows
                    });
                }
            } catch (error) {
                console.warn(`Could not get table status for table ${tableName}:`, error);
            }
        }

        return NextResponse.json(stats, { status: 200 });
    } catch (error) {
        console.error('Error fetching table statistics:', error);

        return NextResponse.json(
            { error: 'Failed to fetch table statistics', details: (error as Error).message },
            { status: 500 }
        );
    }
}