// lib/db.ts
import sqlite3 from "sqlite3";
import { open, Database as SQLiteDatabase } from "sqlite";
import pg from "pg";
import mysql, { QueryResult } from "mysql2/promise";
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
  type: process.env.DB_DRIVER === 'mysql' ? 'mysql' : 'sqlite',
  mysql: process.env.DB_DRIVER === 'mysql' ? {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || ''
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
  id: number;
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
}

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

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  if (databaseConfig.type === 'mysql') {
    const [rows] = await (db as mysql.Pool).execute(
      'SELECT * FROM settings WHERE id = 1'
    );
    if (!rows || (rows as any[]).length === 0) {
      return {
        id: 1,
        systemPrompt: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    return (rows as any[])[0] as Settings;
  } else {
    const row = await (db as SQLiteDatabase).get(
      'SELECT * FROM settings WHERE id = 1'
    );
    if (!row) {
      return {
        id: 1,
        systemPrompt: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    return row as Settings;
  }
}

export async function saveSettings(systemPrompt: string): Promise<void> {
  const db = await getDb();
  const now = databaseConfig.type === 'mysql' 
    ? new Date().toISOString().slice(0, 19).replace('T', ' ')  // MySQL format: 'YYYY-MM-DD HH:MM:SS'
    : new Date().toISOString();  // SQLite format: ISO string

  if (databaseConfig.type === 'mysql') {
    await (db as mysql.Pool).execute(
      'INSERT INTO settings (id, systemPrompt, created_at, updated_at) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE systemPrompt = ?, updated_at = ?',
      [systemPrompt, now, now, systemPrompt, now]
    );
  } else {
    await (db as SQLiteDatabase).run(
      'INSERT OR REPLACE INTO settings (id, systemPrompt, created_at, updated_at) VALUES (1, ?, ?, ?)',
      [systemPrompt, now, now]
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

export async function getDatabaseConnection(id: number, userId: string): Promise<DatabaseConnection | null> {
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
  const connections = await getDatabaseConnections(userId);
  const connection = connections.find(conn => conn.id === connectionId);
  
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
    const [createTableResult] = await connection.query(`SHOW CREATE TABLE ${table.TABLE_NAME}`);
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
  if (databaseConfig.type === 'mysql') {
    await (db as mysql.Pool).execute(
      `
      INSERT INTO users (id, name, email, image, github_id)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        image = VALUES(image),
        github_id = VALUES(github_id)
      `,
      [user.id, user.name, user.email, user.image, user.githubId]
    );
  } else {
    await (db as SQLiteDatabase).run(
      `
      INSERT OR REPLACE INTO users (id, name, email, image, github_id)
      VALUES (?, ?, ?, ?, ?)
      `,
      [user.id, user.name, user.email, user.image, user.githubId]
    );
  }
}

async function initializeDatabase() {
  const db = await getDb();
  console.log("Initializing database...");
  if (databaseConfig.type === 'sqlite') {
    await (db as SQLiteDatabase).exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        image TEXT,
        github_id TEXT NOT NULL,
        last_login_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        theme TEXT DEFAULT 'light',
        language TEXT DEFAULT 'en',
        timezone TEXT DEFAULT 'UTC',
        notifications_enabled INTEGER DEFAULT 1,
        email_notifications INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        activity_details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id TEXT NOT NULL,
        permission TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, permission)
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        connectionId INTEGER,
        title TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversationId INTEGER,
        content TEXT,
        sender TEXT CHECK(sender IN ('user', 'system')),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        share_token TEXT UNIQUE
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        systemPrompt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS database_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        projectName TEXT,
        dbDriver TEXT,
        dbHost TEXT,
        dbPort TEXT,
        dbUsername TEXT,
        dbPassword TEXT,
        dbName TEXT,
        schema TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS query_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        connectionId INTEGER,
        query TEXT,
        sql TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_user_activity ON user_activity(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_user_conversations ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_messages ON messages(conversationId);
      CREATE INDEX IF NOT EXISTS idx_user_connections ON database_connections(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_history ON query_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_settings ON settings(systemPrompt);
      CREATE INDEX IF NOT EXISTS idx_share_token ON messages(share_token);
    `);
    console.log("Database initialized");
  } else {
    // please setup mysql db using schema from /scripts/query_craft_schema.sql
    console.log("Please setup MySQL database using schema from /scripts/query_craft_schema.sql");
  }
}

// Call initializeDatabase when the module is loaded
initializeDatabase().catch(console.error);

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
      now,
      now
    ] as const;

    if (databaseConfig.type === 'mysql') {
      const [result] = await (db as mysql.Pool).execute(
        'INSERT INTO database_connections (user_id, projectName, dbDriver, dbHost, dbPort, dbUsername, dbPassword, dbName, `schema`, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params
      );
      return (result as any).insertId;
    } else {
      const result = await (db as SQLiteDatabase).run(
        'INSERT INTO database_connections (user_id, projectName, dbDriver, dbHost, dbPort, dbUsername, dbPassword, dbName, schema, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
      'UPDATE database_connections SET projectName = ?, dbDriver = ?, dbHost = ?, dbPort = ?, dbUsername = ?, dbPassword = ?, dbName = ?, `schema` = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [
        connection.projectName,
        connection.dbDriver,
        connection.dbHost,
        connection.dbPort,
        connection.dbUsername,
        connection.dbPassword,
        connection.dbName,
        connection.schema,
        now,
        connection.id,
        userId
      ]
    );
  } else {
    await (db as SQLiteDatabase).run(
      'UPDATE database_connections SET projectName = ?, dbDriver = ?, dbHost = ?, dbPort = ?, dbUsername = ?, dbPassword = ?, dbName = ?, schema = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [
        connection.projectName,
        connection.dbDriver,
        connection.dbHost,
        connection.dbPort,
        connection.dbUsername,
        connection.dbPassword,
        connection.dbName,
        connection.schema,
        now,
        connection.id,
        userId
      ]
    );
  }
}