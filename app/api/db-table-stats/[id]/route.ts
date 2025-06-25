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
        const stats: any = {};

        try {
            // Get record count
            const countResult = await executeQuery(`SELECT COUNT(*) as count FROM \`${tableName}\`;`, connectionId, userId);
            stats.recordCount = countResult[0]?.count || 0;
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
                stats.estimatedRows = info.TABLE_ROWS;
                stats.dataLength = info.DATA_LENGTH;
                stats.indexLength = info.INDEX_LENGTH;
                stats.createTime = info.CREATE_TIME;
                stats.updateTime = info.UPDATE_TIME;
                stats.comment = info.TABLE_COMMENT;
                
                // Debug logging
                console.log(`Table ${tableName} stats:`, {
                    updateTime: info.UPDATE_TIME,
                    createTime: info.CREATE_TIME,
                    dataLength: info.DATA_LENGTH,
                    tableRows: info.TABLE_ROWS
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
                    stats.updateTime = status.Update_time;
                    stats.createTime = stats.createTime || status.Create_time;
                    stats.dataLength = stats.dataLength || status.Data_length;
                    stats.estimatedRows = stats.estimatedRows || status.Rows;
                    
                    console.log(`Table ${tableName} status:`, {
                        updateTime: status.Update_time,
                        createTime: status.Create_time,
                        dataLength: status.Data_length,
                        rows: status.Rows
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