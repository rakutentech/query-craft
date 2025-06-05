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
    return mysql.createPool({
      host: databaseConfig.mysql?.host || 'localhost',
      port: databaseConfig.mysql?.port || 3306,
      user: databaseConfig.mysql?.user || '',
      password: databaseConfig.mysql?.password || '',
      database: databaseConfig.mysql?.database || '',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
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
  console.log("Testing database connection:", connection.projectName);
  try {
    switch (connection.dbDriver) {
      case "mysql":
        const mysqlPool = mysql.createPool({
          host: connection.dbHost,
          port: parseInt(connection.dbPort),
          user: connection.dbUsername,
          password: connection.dbPassword,
          database: connection.dbName,
          connectionLimit: 1
        });
        const mysqlConnection = await mysqlPool.getConnection();
        await mysqlConnection.release();
        await mysqlPool.end();
        break;
      case "postgresql":
        const pgPool = new pg.Pool({
          host: connection.dbHost,
          port: parseInt(connection.dbPort),
          user: connection.dbUsername,
          password: connection.dbPassword,
          database: connection.dbName,
          max: 1
        });
        const pgClient = await pgPool.connect();
        await pgClient.release();
        await pgPool.end();
        break;
      case "mariadb":
        const mariadbPool = mariadb.createPool({
          host: connection.dbHost,
          port: parseInt(connection.dbPort),
          user: connection.dbUsername,
          password: connection.dbPassword,
          database: connection.dbName,
          connectionLimit: 1
        });
        const mariadbConnection = await mariadbPool.getConnection();
        await mariadbConnection.release();
        await mariadbPool.end();
        break;
      default:
        throw new Error(`Unsupported database driver: ${connection.dbDriver}`);
    }
    console.log("Database connection test successful:", connection.projectName);
    return true;
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
  try {
    switch (connection.dbDriver) {
      case "mysql":
        pool = mysql.createPool({
          host: connection.dbHost,
          port: parseInt(connection.dbPort),
          user: connection.dbUsername,
          password: connection.dbPassword,
          database: connection.dbName,
          connectionLimit: 10
        });
        const [rows] = await pool.query(sql);
        result = rows;
        break;
      case "postgresql":
        pool = new pg.Pool({
          host: connection.dbHost,
          port: parseInt(connection.dbPort),
          user: connection.dbUsername,
          password: connection.dbPassword,
          database: connection.dbName,
          max: 10
        });
        const pgResult = await pool.query(sql);
        result = pgResult.rows;
        break;
      case "mariadb":
        pool = mariadb.createPool({
          host: connection.dbHost,
          port: parseInt(connection.dbPort),
          user: connection.dbUsername,
          password: connection.dbPassword,
          database: connection.dbName,
          connectionLimit: 10
        });
        result = await pool.query(sql);
        break;
      default:
        throw new Error(`Unsupported database driver: ${connection.dbDriver}`);
    }
  } catch (error) {
    console.error("Error executing query:", error);
    throw new Error(`Query execution failed: ${(error as Error).message}`);
  } finally {
    if (pool) {
      await pool.end();
    }
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

  switch (connection.dbDriver) {
    case "mysql":
      pool = mysqlStreaming.createPool({
        host: connection.dbHost,
        port: parseInt(connection.dbPort),
        user: connection.dbUsername,
        password: connection.dbPassword,
        database: connection.dbName,
        connectionLimit: 10
      });

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
              connection.release();
              pool.end();
            });

            // Handle error events
            queryStream.on('error', (err: any) => {
              console.error("Error executing query:", err.message);
              controller.enqueue(encoder.encode(JSON.stringify({error: err.message}) + "\n"));
              controller.close();
              connection.release();
              pool.end();
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
      pool = new pg.Pool({
                host: connection.dbHost,
                port: parseInt(connection.dbPort),
                user: connection.dbUsername,
                password: connection.dbPassword,
                database: connection.dbName,
                max: 10
              });

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
              conn.release();
              pool.end();
            });

            // Handle error events
            queryStream.on('error', (err: any) => {
              controller.enqueue(encoder.encode(JSON.stringify({error: err.message}) + "\n"));
              controller.close();
              conn.release();
              pool.end();
            });
          } catch (err: any) {
            controller.enqueue(encoder.encode(JSON.stringify({ error: err.message }) + '\n'));
            controller.close();
            conn.release();
            pool.end();
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
      pool = mariadb.createPool({
        host: connection.dbHost,
        port: parseInt(connection.dbPort),
        user: connection.dbUsername,
        password: connection.dbPassword,
        database: connection.dbName,
        connectionLimit: 10
      });

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
              connection.release();
              pool.end();
            });

            queryStream.on('error', (err: any) => {
              controller.enqueue(encoder.encode(JSON.stringify({ error: err.message }) + "\n"));
              controller.close();
              connection.release();
              pool.end();
            });
          } catch (error) {
            controller.enqueue(encoder.encode(JSON.stringify({ error: (error as Error).message }) + "\n"));
            controller.close();
            pool.end();
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

  try {
    switch (connection.dbDriver) {
      case "mysql":
        const mysqlPool = mysql.createPool({
          host: connection.dbHost,
          port: parseInt(connection.dbPort),
          user: connection.dbUsername,
          password: connection.dbPassword,
          database: connection.dbName,
          connectionLimit: 1
        });
        const mysqlConnection = await mysqlPool.getConnection();
        schema = await getMySQLSchema(mysqlConnection, connection.dbName);
        await mysqlConnection.release();
        await mysqlPool.end();
        break;
      case "mariadb":
        const mariadbPool = mariadb.createPool({
          host: connection.dbHost,
          port: parseInt(connection.dbPort),
          user: connection.dbUsername,
          password: connection.dbPassword,
          database: connection.dbName,
          connectionLimit: 1
        });
        const mariadbConnection = await mariadbPool.getConnection();
        schema = await getMariaDBSchema(mariadbConnection, connection.dbName);
        await mariadbConnection.release();
        await mariadbPool.end();
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
  const [tables] = await connection.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = ?
    AND TABLE_TYPE = 'BASE TABLE'
  `, [dbName]);

  let schema = 'Database Type: MySQL\n\n';

  for (const table of tables as any[]) {
    const [createTableResult] = await connection.query(`SHOW CREATE TABLE ${table.TABLE_NAME}`);
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