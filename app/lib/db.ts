// lib/db.ts
import sqlite3 from "sqlite3";
import { open, Database as SQLiteDatabase } from "sqlite";
import pg from "pg";
import QueryStream from 'pg-query-stream';
import mysqlStreaming from "mysql2";
import mysql from "mysql2/promise";
import mariadb from "mariadb";
import util from 'util';
import { exec } from 'child_process';
import path from 'path';
import crypto from 'crypto';

// Cache for database connection pools
interface ConnectionPoolCache {
  [key: string]: {
    pool: any;
    lastUsed: number;
  };
}

export interface DatabaseConfig {
  type: 'sqlite' | 'mysql';
  mysql?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
}


export const databaseConfig: DatabaseConfig = {
  type: process.env.APP_DB_DRIVER === 'mysql' ? 'mysql' : 'sqlite',
  mysql: process.env.APP_DB_DRIVER === 'mysql' ? {
    host: process.env.APP_DB_HOST || 'localhost',
    port: parseInt(process.env.APP_DB_PORT || '3306'),
    user: process.env.APP_DB_USER || '',
    password: process.env.APP_DB_PASSWORD || '',
    database: process.env.APP_DB_NAME || ''
  } : undefined
};

// Connection pool caches
const mysqlStreamingPools: ConnectionPoolCache = {};
const pgPools: ConnectionPoolCache = {};
const mariadbPools: ConnectionPoolCache = {};

// Cleanup old connection pools periodically
const POOL_TTL = 1000 * 60 * 30; // 30 minutes
setInterval(() => {
  const now = Date.now();
  
  // Clean up MySQL streaming pools
  Object.keys(mysqlStreamingPools).forEach(key => {
    if (now - mysqlStreamingPools[key].lastUsed > POOL_TTL) {
      console.log(`Closing unused MySQL streaming pool: ${key}`);
      try {
        mysqlStreamingPools[key].pool.end();
      } catch (err) {
        console.error(`Error closing MySQL streaming pool: ${err}`);
      }
      delete mysqlStreamingPools[key];
    }
  });
  
  // Clean up PostgreSQL pools
  Object.keys(pgPools).forEach(key => {
    if (now - pgPools[key].lastUsed > POOL_TTL) {
      console.log(`Closing unused PostgreSQL pool: ${key}`);
      try {
        pgPools[key].pool.end();
      } catch (err) {
        console.error(`Error closing PostgreSQL pool: ${err}`);
      }
      delete pgPools[key];
    }
  });
  
  // Clean up MariaDB pools
  Object.keys(mariadbPools).forEach(key => {
    if (now - mariadbPools[key].lastUsed > POOL_TTL) {
      console.log(`Closing unused MariaDB pool: ${key}`);
      try {
        mariadbPools[key].pool.end();
      } catch (err) {
        console.error(`Error closing MariaDB pool: ${err}`);
      }
      delete mariadbPools[key];
    }
  });
}, POOL_TTL);

export interface Message {
  id: number;
  conversationId: number;
  content: string;
  sender: "user" | "system";
  timestamp: string;
  share_token?: string;
  sql?: string;
  result?: any;
  error?: boolean;
  connectionId?: number;
}

export interface Conversation {
  id: number;
  user_id: string;
  connectionId: number;
  title: string;
  timestamp: string;
}

export interface Settings {
  user_id: string;
  systemPrompt: string;
  created_at: string;
  updated_at: string;
}
export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  githubId: string;
}

export interface DatabaseConnection {
  id: number;
  user_id: string;
  projectName: string;
  dbDriver: string;
  dbHost: string;
  dbPort: string;
  dbUsername: string;
  dbPassword: string;
  dbName: string;
  schema: string;
  tag?: string;
  created_at: string;
  updated_at: string;
}
export interface QueryHistory {
  id: number;
  user_id: string;
  connectionId: number;
  query: string;
  sql: string;
  timestamp: string;
}

const execPromise = util.promisify(exec);
let sqliteDb: SQLiteDatabase | null = null;
let mysqlPool: mysql.Pool | null = null;

export async function getDb() {
  if (databaseConfig.type === 'mysql') {
    // Reuse existing MySQL pool if it exists
    if (!mysqlPool) {
      mysqlPool = mysql.createPool({
        host: databaseConfig.mysql?.host || 'localhost',
        port: databaseConfig.mysql?.port || 3306,
        user: databaseConfig.mysql?.user || '',
        password: databaseConfig.mysql?.password || '',
        database: databaseConfig.mysql?.database || '',
        waitForConnections: true,
        connectionLimit: 25, // Increased connection limit
        queueLimit: 0
      });
      
      // Test the connection to make sure it works
      try {
        const [rows] = await mysqlPool.execute('SELECT 1');
        console.log('MySQL connection pool initialized successfully');
      } catch (error) {
        console.error('Failed to initialize MySQL connection pool:', error);
        mysqlPool = null;
        throw error;
      }
    }
    return mysqlPool;
  } else {
    if (!sqliteDb) {
      try {
        const dbPath = path.join(process.cwd(), 'query_craft.sqlite');
        sqliteDb = await open({
          filename: dbPath,
          driver: sqlite3.Database
        });

        // Test the connection
        await sqliteDb.get('SELECT 1');
      } catch (err) {
        const error = err as Error;
        console.error('Failed to connect to SQLite database:', {
          error: error.message,
          path: path.join(process.cwd(), 'query_craft.sqlite')
        });
        throw new Error(`SQLite connection failed: ${error.message}`);
      }
    }
    return sqliteDb;
  }
}

export async function createConversation(
  title: string, connectionId: string, userId: string
): Promise<number | undefined> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    const [result] = await (db as mysql.Pool).execute(
      'INSERT INTO conversations (title, connectionId, user_id, timestamp) VALUES (?, ?, ?, NOW())',
      [title, connectionId, userId]
    );
    return (result as any).insertId;
  } else {
    const result = await (db as SQLiteDatabase).run(
      'INSERT INTO conversations (title, connectionId, user_id, timestamp) VALUES (?, ?, ?, datetime("now"))',
      [title, connectionId, userId]
    );
    return result.lastID;
  }
}

export async function addMessage(
  conversationId: number,
  content: string,
  sender: "user" | "system"
): Promise<void> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    await (db as mysql.Pool).execute(
      'INSERT INTO messages (conversationId, content, sender, timestamp) VALUES (?, ?, ?, NOW())',
      [conversationId, content, sender]
    );
  } else {
    await (db as SQLiteDatabase).run(
      'INSERT INTO messages (conversationId, content, sender, timestamp) VALUES (?, ?, ?, datetime("now"))',
      [conversationId, content, sender]
    );
  }
}

export async function getConversationMessages(
  conversationId: number
): Promise<Message[]> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    const [rows] = await (db as mysql.Pool).execute(
      "SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC",
      [conversationId]
    );
    return rows as Message[];
  } else {
    return (db as SQLiteDatabase).all<Message[]>(
      "SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC",
      [conversationId]
    );
  }
}getConversationMessages

export async function getConversationByConnectionId(
  connectionId: number
): Promise<Message[]> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    const [rows] = await (db as mysql.Pool).execute(
      "SELECT * FROM conversations WHERE connectionId=?",
      [connectionId]
    );
    return rows as Message[];
  } else {
    return (db as SQLiteDatabase).all<Message[]>(
      "SELECT * FROM conversations WHERE connectionId=?",
      [connectionId]
    );
  }
}

export async function getConversations(): Promise<Conversation[]> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    const [rows] = await (db as mysql.Pool).execute(
      "SELECT * FROM conversations ORDER BY timestamp DESC"
    );
    return rows as Conversation[];
  } else {
    return (db as SQLiteDatabase).all<Conversation[]>(
      "SELECT * FROM conversations ORDER BY timestamp DESC"
    );
  }
}

export async function updateConversationTitle(
  conversationId: number,
  title: string
): Promise<void> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    await (db as mysql.Pool).execute(
      "UPDATE conversations SET title = ? WHERE id = ?",
      [title, conversationId]
    );
  } else {
    await (db as SQLiteDatabase).run(
      "UPDATE conversations SET title = ? WHERE id = ?",
      [title, conversationId]
    );
  }
}


export async function addToHistory(connectionId: number, query: string, sql: string, userId: string): Promise<void> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    await (db as mysql.Pool).execute(
      'INSERT INTO query_history (connectionId, query, `sql`, user_id, timestamp) VALUES (?, ?, ?, ?, NOW())',
      [connectionId, query, sql, userId]
    );
  } else {
    await (db as SQLiteDatabase).run(
      'INSERT INTO query_history (connectionId, query, sql, user_id, timestamp) VALUES (?, ?, ?, ?, datetime("now"))',
      [connectionId, query, sql, userId]
    );
  }
}

export async function getHistory(connectionId: number, userId: string): Promise<QueryHistory[]> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    const [rows] = await (db as mysql.Pool).execute(
      "SELECT * FROM query_history WHERE connectionId = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 10",
      [connectionId, userId]
    );
    return rows as QueryHistory[];
  } else {
    return (db as SQLiteDatabase).all<QueryHistory[]>(
      "SELECT * FROM query_history WHERE connectionId = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 10",
      [connectionId, userId]
    );
  }
}

export async function getSettings(userId: string): Promise<Settings> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    const [rows] = await (db as mysql.Pool).execute(
      'SELECT * FROM settings WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (!rows || (rows as any[]).length === 0) {
      return {
        user_id: userId,
        systemPrompt: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    return (rows as any[])[0] as Settings;
  } else {
    const row = await (db as SQLiteDatabase).get(
      'SELECT * FROM settings WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (!row) {
      return {
        user_id: userId,
        systemPrompt: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    return row as Settings;
  }
}

export async function saveSettings(userId: string, systemPrompt: string): Promise<void> {
  const db = await getDb();
  const now = databaseConfig.type === 'mysql'
    ? new Date().toISOString().slice(0, 19).replace('T', ' ')
    : new Date().toISOString();
  if (databaseConfig.type === 'mysql') {
    await (db as mysql.Pool).execute(
      'INSERT INTO settings (user_id, systemPrompt, created_at, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE systemPrompt = ?, updated_at = ?',
      [userId, systemPrompt, now, now, systemPrompt, now]
    );
  } else {
    await (db as SQLiteDatabase).run(
      'INSERT OR REPLACE INTO settings (user_id, systemPrompt, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [userId, systemPrompt, now, now]
    );
  }
}

export async function getDatabaseConnections(userId: string): Promise<DatabaseConnection[]> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    const [rows] = await (db as mysql.Pool).execute(
      'SELECT * FROM database_connections WHERE user_id = ?',
      [userId]
    );
    return rows as DatabaseConnection[];
  } else {
    return (db as SQLiteDatabase).all<DatabaseConnection[]>(
      'SELECT * FROM database_connections WHERE user_id = ?',
      [userId]
    );
  }
}

export async function getUserConnectionById(id: number, userId: string): Promise<DatabaseConnection | null> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    const [rows] = await (db as mysql.Pool).execute(
      'SELECT * FROM database_connections WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    const connection = (rows as any[])[0];
    if (!connection) return null;
    return {
      id: connection.id,
      user_id: connection.user_id,
      projectName: connection.projectName ?? '',
      dbDriver: connection.dbDriver ?? '',
      dbHost: connection.dbHost ?? '',
      dbPort: connection.dbPort ?? '',
      dbUsername: connection.dbUsername ?? '',
      dbPassword: connection.dbPassword ?? '',
      dbName: connection.dbName ?? '',
      schema: connection.schema ?? '',
      created_at: connection.created_at,
      updated_at: connection.updated_at
    };
  } else {
    const connection = await (db as SQLiteDatabase).get<DatabaseConnection>(
      'SELECT * FROM database_connections WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (!connection) return null;
    return {
      id: connection.id,
      user_id: connection.user_id,
      projectName: connection.projectName ?? '',
      dbDriver: connection.dbDriver ?? '',
      dbHost: connection.dbHost ?? '',
      dbPort: connection.dbPort ?? '',
      dbUsername: connection.dbUsername ?? '',
      dbPassword: connection.dbPassword ?? '',
      dbName: connection.dbName ?? '',
      schema: connection.schema ?? '',
      created_at: connection.created_at,
      updated_at: connection.updated_at
    };
  }
}

export async function deleteDatabaseConnection(id: number, userId: string): Promise<void> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    await (db as mysql.Pool).execute(
      'DELETE FROM database_connections WHERE id = ? AND user_id = ?',
      [id, userId]
    );
  } else {
    await (db as SQLiteDatabase).run(
      'DELETE FROM database_connections WHERE id = ? AND user_id = ?',
      [id, userId]
    );
  }
}

export async function testDatabaseConnection(connection: DatabaseConnection): Promise<boolean> {
  const connectionKey = `${connection.dbHost}:${connection.dbPort}:${connection.dbUsername}:${connection.dbName}`;
  
  try {
    switch (connection.dbDriver) {
      case "mysql":
        // Use an existing pool if available for this connection
        if (mysqlStreamingPools[connectionKey]) {
          console.log(`Using existing MySQL pool for connection test: ${connectionKey}`);
          const pool = mysqlStreamingPools[connectionKey].pool;
          
          // Get a connection from the pool
          const conn = await new Promise<any>((resolve, reject) => {
            pool.getConnection((err: any, conn: any) => {
              if (err) reject(err);
              else resolve(conn);
            });
          });
          
          try {
            // Execute a simple query to test the connection
            await new Promise<void>((resolve, reject) => {
              conn.query('SELECT 1', (err: any) => {
                if (err) reject(err);
                else resolve();
              });
            });
            
            mysqlStreamingPools[connectionKey].lastUsed = Date.now();
            return true;
          } finally {
            conn.release(); // Release the connection back to the pool
          }
        } else {
          // Create a temporary connection for testing
          const tempPool = mysqlStreaming.createPool({
            host: connection.dbHost,
            port: parseInt(connection.dbPort),
            user: connection.dbUsername,
            password: connection.dbPassword,
            database: connection.dbName,
            connectionLimit: 1
          });
          
          try {
            const conn = await new Promise<any>((resolve, reject) => {
              tempPool.getConnection((err: any, conn: any) => {
                if (err) reject(err);
                else resolve(conn);
              });
            });
            
            try {
              await new Promise<void>((resolve, reject) => {
                conn.query('SELECT 1', (err: any) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
              return true;
            } finally {
              conn.release();
              tempPool.end(); // End the temporary pool
            }
          } catch (error) {
            console.error("Error testing MySQL connection:", error);
            throw error;
          }
        }
        
      case "postgresql":
        // Use an existing pool if available
        if (pgPools[connectionKey]) {
          console.log(`Using existing PostgreSQL pool for connection test: ${connectionKey}`);
          const pool = pgPools[connectionKey].pool;
          const client = await pool.connect();
          
          try {
            await client.query('SELECT 1');
            pgPools[connectionKey].lastUsed = Date.now();
            return true;
          } finally {
            client.release();
          }
        } else {
          // Create a temporary client for testing
          const client = new pg.Client({
            host: connection.dbHost,
            port: parseInt(connection.dbPort),
            user: connection.dbUsername,
            password: connection.dbPassword,
            database: connection.dbName
          });
          
          try {
            await client.connect();
            await client.query('SELECT 1');
            return true;
          } finally {
            await client.end();
          }
        }
        
      case "mariadb":
        // Use an existing pool if available
        if (mariadbPools[connectionKey]) {
          console.log(`Using existing MariaDB pool for connection test: ${connectionKey}`);
          const pool = mariadbPools[connectionKey].pool;
          const conn = await pool.getConnection();
          
          try {
            await conn.query('SELECT 1');
            mariadbPools[connectionKey].lastUsed = Date.now();
            return true;
          } finally {
            conn.release();
          }
        } else {
          // Create a temporary connection for testing
          const tempPool = mariadb.createPool({
            host: connection.dbHost,
            port: parseInt(connection.dbPort),
            user: connection.dbUsername,
            password: connection.dbPassword,
            database: connection.dbName,
            connectionLimit: 1
          });
          
          try {
            const conn = await tempPool.getConnection();
            await conn.query('SELECT 1');
            conn.release();
            return true;
          } finally {
            tempPool.end();
          }
        }
        
      default:
        throw new Error(`Unsupported database driver: ${connection.dbDriver}`);
    }
  } catch (error) {
    console.error("Error testing database connection:", error);
    throw new Error(`Connection test failed: ${(error as Error).message}`);
  }
}

export async function executeQuery(sql: string, connectionId: number, userId: string): Promise<any[]> {
  const connection = await getUserConnectionById(connectionId, userId);
  
  if (!connection) {
    throw new Error(`Database connection not found for id: ${connectionId}`);
  }

  let result: any[];
  let pool: any;
  
  // Create a unique key for this connection
  const connectionKey = `${connection.dbHost}:${connection.dbPort}:${connection.dbUsername}:${connection.dbName}`;
  
  try {
    switch (connection.dbDriver) {
      case "mysql":
        // Reuse or create MySQL pool
        if (!mysqlStreamingPools[connectionKey]) {
          console.log(`Creating new MySQL pool for ${connectionKey}`);
          mysqlStreamingPools[connectionKey] = {
            pool: mysqlStreaming.createPool({
              host: connection.dbHost,
              port: parseInt(connection.dbPort),
              user: connection.dbUsername,
              password: connection.dbPassword,
              database: connection.dbName,
              connectionLimit: 15
            }),
            lastUsed: Date.now()
          };
        } else {
          console.log(`Reusing MySQL pool for ${connectionKey}`);
          mysqlStreamingPools[connectionKey].lastUsed = Date.now();
        }
        
        pool = mysqlStreamingPools[connectionKey].pool;
        
        // Get a connection from the pool
        const mysqlConn = await new Promise<any>((resolve, reject) => {
          pool.getConnection((err: any, conn: any) => {
            if (err) reject(err);
            else resolve(conn);
          });
        });
        
        try {
          const [rows] = await new Promise<any[]>((resolve, reject) => {
            mysqlConn.query(sql, (err: any, res: any) => {
              if (err) reject(err);
              else resolve([res]);
            });
          });
          result = rows;
        } finally {
          mysqlConn.release(); // Release the connection back to the pool
        }
        break;
        
      case "postgresql":
        // Reuse or create PostgreSQL pool
        if (!pgPools[connectionKey]) {
          console.log(`Creating new PostgreSQL pool for ${connectionKey}`);
          pgPools[connectionKey] = {
            pool: new pg.Pool({
              host: connection.dbHost,
              port: parseInt(connection.dbPort),
              user: connection.dbUsername,
              password: connection.dbPassword,
              database: connection.dbName,
              max: 15
            }),
            lastUsed: Date.now()
          };
        } else {
          console.log(`Reusing PostgreSQL pool for ${connectionKey}`);
          pgPools[connectionKey].lastUsed = Date.now();
        }
        
        pool = pgPools[connectionKey].pool;
        const pgResult = await pool.query(sql);
        result = pgResult.rows;
        break;
        
      case "mariadb":
        // Reuse or create MariaDB pool
        if (!mariadbPools[connectionKey]) {
          console.log(`Creating new MariaDB pool for ${connectionKey}`);
          mariadbPools[connectionKey] = {
            pool: mariadb.createPool({
              host: connection.dbHost,
              port: parseInt(connection.dbPort),
              user: connection.dbUsername,
              password: connection.dbPassword,
              database: connection.dbName,
              connectionLimit: 15
            }),
            lastUsed: Date.now()
          };
        } else {
          console.log(`Reusing MariaDB pool for ${connectionKey}`);
          mariadbPools[connectionKey].lastUsed = Date.now();
        }
        
        pool = mariadbPools[connectionKey].pool;
        result = await pool.query(sql);
        break;
        
      default:
        throw new Error(`Unsupported database driver: ${connection.dbDriver}`);
    }
  } catch (error) {
    console.error("Error executing query:", error);
    throw new Error(`Query execution failed: ${(error as Error).message}`);
  }

  return result;
}

// Function to execute a query and return the streaming reslut
export async function executeQueryStream(sql: string, connectionId: number, userId: string): Promise<Response> {
  const connection = await getUserConnectionById(connectionId, userId);

  if (!connection) {
    throw new Error(`Database connection not found for id: ${connectionId}`);
  }

  const encoder = new TextEncoder();
  const RATE_LIMIT = 100; // Rows per second
  const interval = 1000; // Milliseconds
  const tokensPerInterval = RATE_LIMIT;
  let tokens = tokensPerInterval;
  let lastFill = Date.now();

  const pendingRows: any[] = [];
  let closed = false;
  let pool: any;

  // Create a unique key for this connection
  const connectionKey = `${connection.dbHost}:${connection.dbPort}:${connection.dbUsername}:${connection.dbName}`;

  switch (connection.dbDriver) {
    case "mysql":
      // Get or create MySQL pool
      if (!mysqlStreamingPools[connectionKey]) {
        console.log(`Creating new MySQL streaming pool for ${connectionKey}`);
        mysqlStreamingPools[connectionKey] = {
          pool: mysqlStreaming.createPool({
            host: connection.dbHost,
            port: parseInt(connection.dbPort),
            user: connection.dbUsername,
            password: connection.dbPassword,
            database: connection.dbName,
            connectionLimit: 15
          }),
          lastUsed: Date.now()
        };
      } else {
        console.log(`Reusing MySQL streaming pool for ${connectionKey}`);
        mysqlStreamingPools[connectionKey].lastUsed = Date.now();
      }
      
      pool = mysqlStreamingPools[connectionKey].pool;

      const mysqlStream = new ReadableStream({
        async start(controller) {
          pool.getConnection((err: any, connection: any) => {
            if (err) {
              controller.error(err);
              return;
            }

            // Stream the results of the query
            const queryStream = connection.query(sql).stream({objectMode: true});

            queryStream.on('data', (row: any) => {
              if (closed) return; // If the stream is closed, do not process further
              const now = Date.now();
              const elapsed = now - lastFill;

              if (tokens > 0) {
                tokens--;
                controller.enqueue(encoder.encode(JSON.stringify(row, jsonBigIntReplacer) + "\n"));
              } else {
                // Pause stream and schedule resume
                queryStream.pause();
                pendingRows.push(row);
                const delay = interval - elapsed > 0 ? interval - elapsed : 0;
                setTimeout(() => {
                  tokens = tokensPerInterval;
                  lastFill = Date.now();
                  while (tokens > 0 && pendingRows.length > 0) {
                    tokens--;
                    const nextRow = pendingRows.shift();
                    controller.enqueue(encoder.encode(JSON.stringify(nextRow, jsonBigIntReplacer) + "\n"));
                  }
                  queryStream.resume();
                }, delay);
              }
            });

            // Handle end event
            queryStream.on('end', () => {
              closed = true;
              // Flush any remaining pending rows
              while (pendingRows.length > 0) {
                controller.enqueue(encoder.encode(JSON.stringify(pendingRows.shift(), jsonBigIntReplacer) + "\n"));
              }
              controller.close();
              connection.release(); // Release connection back to pool, but don't end the pool
            });

            // Handle error events
            queryStream.on('error', (err: any) => {
              console.error("Error executing query:", err.message);
              controller.enqueue(encoder.encode(JSON.stringify({error: err.message}) + "\n"));
              controller.close();
              connection.release(); // Release connection back to pool
            });
          });
        }
      });

      return new Response(mysqlStream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
        }
      });
    case "postgresql":
      // Get or create PostgreSQL pool
      if (!pgPools[connectionKey]) {
        console.log(`Creating new PostgreSQL pool for ${connectionKey}`);
        pgPools[connectionKey] = {
          pool: new pg.Pool({
            host: connection.dbHost,
            port: parseInt(connection.dbPort),
            user: connection.dbUsername,
            password: connection.dbPassword,
            database: connection.dbName,
            max: 15
          }),
          lastUsed: Date.now()
        };
      } else {
        console.log(`Reusing PostgreSQL pool for ${connectionKey}`);
        pgPools[connectionKey].lastUsed = Date.now();
      }
      
      pool = pgPools[connectionKey].pool;

      const postgresqlStream = new ReadableStream({
        async start(controller) {
          const conn = await pool.connect();
          try {
            const query = new QueryStream(sql);
            const queryStream = conn.query(query);

            queryStream.on('data', (row: any) => {
              if (closed) return; // If the stream is closed, do not process further
              const now = Date.now();
              const elapsed = now - lastFill;

              if (tokens > 0) {
                tokens--;
                controller.enqueue(encoder.encode(JSON.stringify(row, jsonBigIntReplacer) + "\n"));
              } else {
                // Pause stream and schedule resume
                queryStream.pause();
                pendingRows.push(row);
                const delay = interval - elapsed > 0 ? interval - elapsed : 0;
                setTimeout(() => {
                  tokens = tokensPerInterval;
                  lastFill = Date.now();
                  while (tokens > 0 && pendingRows.length > 0) {
                    tokens--;
                    const nextRow = pendingRows.shift();
                    controller.enqueue(encoder.encode(JSON.stringify(nextRow, jsonBigIntReplacer) + "\n"));
                  }
                  queryStream.resume();
                }, delay);
              }
            });

            // Handle end event
            queryStream.on('end', () => {
              closed = true;
              // Flush any remaining pending rows
              while (pendingRows.length > 0) {
                controller.enqueue(encoder.encode(JSON.stringify(pendingRows.shift(), jsonBigIntReplacer) + "\n"));
              }
              controller.close();
              conn.release(); // Release connection back to pool, but don't end the pool
            });

            // Handle error events
            queryStream.on('error', (err: any) => {
              controller.enqueue(encoder.encode(JSON.stringify({error: err.message}) + "\n"));
              controller.close();
              conn.release(); // Release connection back to pool
            });
          } catch (err: any) {
            controller.enqueue(encoder.encode(JSON.stringify({ error: err.message }) + '\n'));
            controller.close();
            conn.release(); // Release connection back to pool
          }
        }
      });

      return new Response(postgresqlStream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
        }
      });
    case "mariadb":
      // Get or create MariaDB pool
      if (!mariadbPools[connectionKey]) {
        console.log(`Creating new MariaDB pool for ${connectionKey}`);
        mariadbPools[connectionKey] = {
          pool: mariadb.createPool({
            host: connection.dbHost,
            port: parseInt(connection.dbPort),
            user: connection.dbUsername,
            password: connection.dbPassword,
            database: connection.dbName,
            connectionLimit: 15
          }),
          lastUsed: Date.now()
        };
      } else {
        console.log(`Reusing MariaDB pool for ${connectionKey}`);
        mariadbPools[connectionKey].lastUsed = Date.now();
      }
      
      pool = mariadbPools[connectionKey].pool;

      const mariadbStream = new ReadableStream({
        async start(controller) {
          try {
            const connection = await pool.getConnection();
            const queryStream = connection.queryStream(sql);

            queryStream.on('data', (row: any) => {
              if (closed) return; // If the stream is closed, do not process further
              const now = Date.now();
              const elapsed = now - lastFill;

              if (tokens > 0) {
                tokens--;
                controller.enqueue(encoder.encode(JSON.stringify(row, jsonBigIntReplacer) + "\n"));
              } else {
                // Pause stream and schedule resume
                queryStream.pause();
                pendingRows.push(row);
                const delay = interval - elapsed > 0 ? interval - elapsed : 0;
                setTimeout(() => {
                  tokens = tokensPerInterval;
                  lastFill = Date.now();
                  while (tokens > 0 && pendingRows.length > 0) {
                    tokens--;
                    const nextRow = pendingRows.shift();
                    controller.enqueue(encoder.encode(JSON.stringify(nextRow, jsonBigIntReplacer) + "\n"));
                  }
                  queryStream.resume();
                }, delay);
              }
            });

            queryStream.on('end', () => {
              closed = true;
              // Flush any remaining pending rows
              while (pendingRows.length > 0) {
                controller.enqueue(encoder.encode(JSON.stringify(pendingRows.shift(), jsonBigIntReplacer) + "\n"));
              }
              controller.close();
              connection.release(); // Release connection back to pool, but don't end the pool
            });

            queryStream.on('error', (err: any) => {
              controller.enqueue(encoder.encode(JSON.stringify({ error: err.message }) + "\n"));
              controller.close();
            });
          } catch (error) {
            controller.enqueue(encoder.encode(JSON.stringify({ error: (error as Error).message }) + "\n"));
            controller.close();
          }
        }
      });

      return new Response(mariadbStream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
        }
      });
  }
    throw new Error(`Unsupported database driver: ${connection.dbDriver}`);
}

function jsonBigIntReplacer(_key: string, value: any) {
  return typeof value === 'bigint' ? value.toString() : value;
}

// Add this new function to retrieve the database schema
export async function getDatabaseSchema(connection: DatabaseConnection): Promise<string> {
  let schema = '';
  const connectionKey = `${connection.dbHost}:${connection.dbPort}:${connection.dbUsername}:${connection.dbName}`;

  try {
    switch (connection.dbDriver) {
      case "mysql":
        // Get or create MySQL pool
        if (!mysqlStreamingPools[connectionKey]) {
          console.log(`Creating new MySQL pool for ${connectionKey}`);
          mysqlStreamingPools[connectionKey] = {
            pool: mysqlStreaming.createPool({
              host: connection.dbHost,
              port: parseInt(connection.dbPort),
              user: connection.dbUsername,
              password: connection.dbPassword,
              database: connection.dbName,
              connectionLimit: 15
            }),
            lastUsed: Date.now()
          };
        } else {
          console.log(`Reusing MySQL pool for ${connectionKey}`);
          mysqlStreamingPools[connectionKey].lastUsed = Date.now();
        }
        
        const mysqlPool = mysqlStreamingPools[connectionKey].pool;
        
        // Get a connection from the pool
        const mysqlConn = await new Promise<any>((resolve, reject) => {
          mysqlPool.getConnection((err: any, conn: any) => {
            if (err) reject(err);
            else resolve(conn);
          });
        });
        
        try {
          schema = await getMySQLSchema(mysqlConn, connection.dbName);
        } finally {
          mysqlConn.release(); // Release the connection back to the pool
        }
        break;
        
      case "mariadb":
        // Get or create MariaDB pool
        if (!mariadbPools[connectionKey]) {
          console.log(`Creating new MariaDB pool for ${connectionKey}`);
          mariadbPools[connectionKey] = {
            pool: mariadb.createPool({
              host: connection.dbHost,
              port: parseInt(connection.dbPort),
              user: connection.dbUsername,
              password: connection.dbPassword,
              database: connection.dbName,
              connectionLimit: 15
            }),
            lastUsed: Date.now()
          };
        } else {
          console.log(`Reusing MariaDB pool for ${connectionKey}`);
          mariadbPools[connectionKey].lastUsed = Date.now();
        }
        
        const mariadbPool = mariadbPools[connectionKey].pool;
        const mariadbConnection = await mariadbPool.getConnection();
        
        try {
          schema = await getMariaDBSchema(mariadbConnection, connection.dbName);
        } finally {
          mariadbConnection.release(); // Release the connection back to the pool
        }
        break;
        
      case "postgresql":
        schema = await getPostgreSQLSchema(connection);
        break;
        
      default:
        throw new Error(`Unsupported database driver: ${connection.dbDriver}`);
    }
  } catch (error) {
    console.error("Error getting database schema:", error);
    throw new Error(`Failed to get schema: ${(error as Error).message}`);
  }

  return schema;
}

async function getMySQLSchema(connection: mysql.Connection, dbName: string): Promise<string> {
  const queryString = mysql.format("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'", dbName);
  const [tables] = await new Promise<any[]>((resolve, reject) => {
    connection.query(queryString, (err: any, results: any) => {
      if (err) reject(err);
      else resolve([results]);
    });
  });

  let schema = 'Database Type: MySQL\n\n';

  for (const table of tables as any[]) {
    const [createTableResult] = await new Promise<any[]>((resolve, reject) => {
      connection.query(`SHOW CREATE TABLE ${table.TABLE_NAME}`, (err: any, results: any) => {
        if (err) reject(err);
        else resolve([results]);
      });
    });
    const tableResult = createTableResult as any
    const createTableStatement = tableResult[0]['Create Table'];

    schema += `${createTableStatement};\n\n`;
  }
  schema += '\n'
  return schema;
}

async function getMariaDBSchema(connection: mariadb.Connection, dbName: string): Promise<string> {
  const tables = await connection.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = ?
    AND TABLE_TYPE = 'BASE TABLE'
  `, [dbName]);

  let schema = 'Database Type: MariaDB\n\n';

  for (const table of tables as any[]) {
    const createTableResult = await connection.query(`SHOW CREATE TABLE ${table.TABLE_NAME}`);
    const tableResult = createTableResult as any
    const createTableStatement = tableResult[0]['Create Table'];

    schema += `${createTableStatement};\n\n`;
  }
  schema += '\n';

  return schema;
}

async function getPostgreSQLSchema(connection: DatabaseConnection): Promise<string> {
  const { dbHost, dbPort, dbUsername, dbName } = connection;
  
  try {
    const { stdout } = await execPromise(
      `PGPASSWORD=${connection.dbPassword} pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUsername} -d ${dbName} --schema-only`
    );
    
    return `Database Type: POSTGRESQL\n\n${stdout}`;
  } catch (error) {
    console.error("Error executing pg_dump:", error);
    throw new Error(`Failed to get PostgreSQL schema: ${(error as Error).message}`);
  }
}

export async function storeUser(user: User): Promise<void> {
  const db = await getDb();
  if (databaseConfig.type === 'sqlite') {
    await (db as SQLiteDatabase).run(`
      INSERT OR REPLACE INTO users (id, name, email, image, github_id, last_login_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [user.id, user.name, user.email, user.image, user.githubId]);
  } else {
    // MySQL implementation
    const [rows] = await (db as mysql.Pool).execute(
      'SELECT * FROM users WHERE id = ?',
      [user.id]
    );
    if (Array.isArray(rows) && rows.length === 0) {
      await (db as mysql.Pool).execute(
        'INSERT INTO users (id, name, email, image, github_id, last_login_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())',
        [user.id, user.name, user.email, user.image, user.githubId]
      );
    } else {
      await (db as mysql.Pool).execute(
        'UPDATE users SET name = ?, email = ?, image = ?, github_id = ?, last_login_at = NOW(), updated_at = NOW() WHERE id = ?',
        [user.name, user.email, user.image, user.githubId, user.id]
      );
    }
  }
}

export async function generateShareToken(messageId: number): Promise<string> {
  const db = await getDb();
  const shareToken = crypto.randomBytes(16).toString('hex');

  if (databaseConfig.type === 'mysql') {
    await (db as any).execute(
      'UPDATE messages SET share_token = ? WHERE id = ?',
      [shareToken, messageId]
    );
  } else {
    await (db as any).run(
      'UPDATE messages SET share_token = ? WHERE id = ?',
      [shareToken, messageId]
    );
  }

  return shareToken;
}

export async function getSharedMessage(token: string): Promise<{ message: Message; canEdit: boolean } | null> {
  const db = await getDb();

  try {
    if (databaseConfig.type === 'mysql') {
      const [message] = await (db as any).execute(
        `SELECT m.*, c.connectionId 
         FROM messages m 
         JOIN conversations c ON m.conversationId = c.id 
         WHERE m.share_token = ?`,
        [token]
      );
      if (!message || message.length === 0) {
        return null;
      }
      return { 
        message: {
          ...message[0],
          connectionId: message[0].connectionId
        }, 
        canEdit: false 
      };
    } else {
      const message = await (db as any).get(
        `SELECT m.*, c.connectionId 
         FROM messages m 
         JOIN conversations c ON m.conversationId = c.id 
         WHERE m.share_token = ?`,
        [token]
      );
      if (!message) {
        return null;
      }
      return { 
        message: {
          ...message,
          connectionId: message.connectionId
        }, 
        canEdit: false 
      };
    }
  } catch (error) {
    console.error('Error fetching shared message:', error);
    throw error;
  }
}

export async function updateSharedMessage(token: string, content: string): Promise<void> {
  const db = await getDb();

  try {
    if (databaseConfig.type === 'mysql') {
      await (db as any).execute(
        'UPDATE messages SET content = ? WHERE share_token = ?',
        [content, token]
      );
    } else {
      await (db as any).run(
        'UPDATE messages SET content = ? WHERE share_token = ?',
        [content, token]
      );
    }
  } catch (error) {
    console.error('Error updating shared message:', error);
    throw error;
  }
}

export async function saveDatabaseConnection(connection: DatabaseConnection, userId: string): Promise<number> {
  const db = await getDb();
  const now = databaseConfig.type === 'mysql' 
    ? new Date().toISOString().slice(0, 19).replace('T', ' ')
    : new Date().toISOString();

  if (connection.id) {
    // Connection exists, update it
    await updateDatabaseConnection(connection, userId);
    return connection.id;
  } else {
    // New connection, insert it
    const params = [
      userId,
      connection.projectName,
      connection.dbDriver,
      connection.dbHost,
      connection.dbPort,
      connection.dbUsername,
      connection.dbPassword,
      connection.dbName,
      connection.schema,
      connection.tag,
      now,
      now
    ] as const;

    if (databaseConfig.type === 'mysql') {
      const [result] = await (db as mysql.Pool).execute(
        'INSERT INTO database_connections (user_id, projectName, dbDriver, dbHost, dbPort, dbUsername, dbPassword, dbName, `schema`, tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params
      );
      return (result as any).insertId;
    } else {
      const result = await (db as SQLiteDatabase).run(
        'INSERT INTO database_connections (user_id, projectName, dbDriver, dbHost, dbPort, dbUsername, dbPassword, dbName, schema, tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params
      );
      return result.lastID!;
    }
  }
}

export async function updateDatabaseConnection(connection: DatabaseConnection, userId: string): Promise<void> {
  const db = await getDb();
  const now = databaseConfig.type === 'mysql' 
    ? new Date().toISOString().slice(0, 19).replace('T', ' ')
    : new Date().toISOString();

  if (databaseConfig.type === 'mysql') {
    await (db as mysql.Pool).execute(
      'UPDATE database_connections SET projectName = ?, dbDriver = ?, dbHost = ?, dbPort = ?, dbUsername = ?, dbPassword = ?, dbName = ?, `schema` = ?, tag = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [
        connection.projectName,
        connection.dbDriver,
        connection.dbHost,
        connection.dbPort,
        connection.dbUsername,
        connection.dbPassword,
        connection.dbName,
        connection.schema,
        connection.tag,
        now,
        connection.id,
        userId
      ]
    );
  } else {
    await (db as SQLiteDatabase).run(
      'UPDATE database_connections SET projectName = ?, dbDriver = ?, dbHost = ?, dbPort = ?, dbUsername = ?, dbPassword = ?, dbName = ?, schema = ?, tag = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [
        connection.projectName,
        connection.dbDriver,
        connection.dbHost,
        connection.dbPort,
        connection.dbUsername,
        connection.dbPassword,
        connection.dbName,
        connection.schema,
        connection.tag,
        now,
        connection.id,
        userId
      ]
    );
  }
}

// Add cleanup for graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Closing all database connections...');
  await cleanupAllPools();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Closing all database connections...');
  await cleanupAllPools();
  process.exit(0);
});

// Function to close all database pools
async function cleanupAllPools() {
  console.log('Cleaning up all database connection pools...');
  
  // Close MySQL app pool
  if (mysqlPool) {
    try {
      console.log('Closing main MySQL pool');
      await mysqlPool.end();
    } catch (err) {
      console.error('Error closing main MySQL pool:', err);
    }
  }
  
  // Close MySQL streaming pools
  for (const key of Object.keys(mysqlStreamingPools)) {
    try {
      console.log(`Closing MySQL streaming pool: ${key}`);
      await mysqlStreamingPools[key].pool.end();
    } catch (err) {
      console.error(`Error closing MySQL streaming pool ${key}:`, err);
    }
  }
  
  // Close PostgreSQL pools
  for (const key of Object.keys(pgPools)) {
    try {
      console.log(`Closing PostgreSQL pool: ${key}`);
      await pgPools[key].pool.end();
    } catch (err) {
      console.error(`Error closing PostgreSQL pool ${key}:`, err);
    }
  }
  
  // Close MariaDB pools
  for (const key of Object.keys(mariadbPools)) {
    try {
      console.log(`Closing MariaDB pool: ${key}`);
      await mariadbPools[key].pool.end();
    } catch (err) {
      console.error(`Error closing MariaDB pool ${key}:`, err);
    }
  }
  
  console.log('All database connection pools closed');
}