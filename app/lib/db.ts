// lib/db.ts
import sqlite3 from "sqlite3";
import { open, Database as SQLiteDatabase } from "sqlite";
import pg from "pg";
import mysql, {QueryResult} from "mysql2/promise";
import mariadb from "mariadb";
import util from 'util';
import { exec } from 'child_process';

const execPromise = util.promisify(exec);
export interface Message {
  id: number;
  conversationId: number;
  content: string;
  sender: "user" | "system";
  timestamp: string;
}

export interface Conversation {
  id: number;
  connectionId: number,
  title: string;
  timestamp: string;
}

let sqliteDb: SQLiteDatabase | null = null;
let mysqlPool: mysql.Pool | null = null;
let pgPool: pg.Pool | null = null;
let mariadbPool: mariadb.Pool | null = null;

async function getSqliteDb(): Promise<SQLiteDatabase> {
  if (sqliteDb) return sqliteDb;

  sqliteDb = await open({
    filename: "./mydb.sqlite",
    driver: sqlite3.Database
  });

  return sqliteDb;
}

export async function createConversation(
  title: string, connectionId: string
): Promise<number | undefined> {
  const db = await getSqliteDb();
  const result = await db.run(
    'INSERT INTO conversations (title, connectionId, timestamp) VALUES (?,?, datetime("now"))',
    [title, connectionId]
  );
  return result.lastID;
}

export async function addMessage(
  conversationId: number,
  content: string,
  sender: "user" | "system"
): Promise<void> {
  const db = await getSqliteDb();
  await db.run(
    'INSERT INTO messages (conversationId, content, sender, timestamp) VALUES (?, ?, ?, datetime("now"))',
    [conversationId, content, sender]
  );
}

export async function getConversationMessages(
  conversationId: number
): Promise<Message[]> {
  const db = await getSqliteDb();
  return db.all<Message[]>(
    "SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC",
    [conversationId]
  );
}

export async function getConversationByConnectionId(
  connectionId: number
): Promise<Message[]> {
  const db = await getSqliteDb();
  return db.all<Message[]>(
   "SELECT * FROM conversations WHERE connectionId=?",
    [connectionId]
  );
}

export async function getConversations(): Promise<Conversation[]> {
  const db = await getSqliteDb();
  return db.all<Conversation[]>(
    "SELECT * FROM conversations ORDER BY timestamp DESC"
  );
}

export async function updateConversationTitle(
  conversationId: number,
  title: string
): Promise<void> {
  const db = await getSqliteDb();
  await db.run("UPDATE conversations SET title = ? WHERE id = ?", [
    title,
    conversationId
  ]);
}
export interface HistoryItem {
  id: number;
  query: string;
  sql: string;
  timestamp: string;
}

export interface Settings {
  id: number;
  systemPrompt: string;
}

export interface DatabaseConnection {
  id?: number; // Make id optional for new connections
  projectName: string;
  dbDriver: string;
  dbHost: string;
  dbPort: string;
  dbUsername: string;
  dbPassword: string;
  dbName: string;
  schema: string; 
}

export async function addToHistory(connectionId: number, query: string, sql: string): Promise<void> {
  const db = await getSqliteDb();
  await db.run(
    'INSERT INTO history (connectionId, query, sql, timestamp) VALUES (?, ?, ?, datetime("now"))',
    [connectionId, query, sql]
  );
}

export async function getHistory(connectionId: number): Promise<HistoryItem[]> {
  const db = await getSqliteDb();
  return db.all<HistoryItem[]>(
    "SELECT * FROM history WHERE connectionId = ? ORDER BY timestamp DESC LIMIT 10",
    [connectionId]
  );
}

export async function getSettings(): Promise<Settings> {
  const db = await getSqliteDb();
  const dbSettings = await db.get<Settings>(
    "SELECT * FROM settings WHERE id = 1"
  );
  return {
    id: 1,
    systemPrompt: dbSettings?.systemPrompt || "",
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  console.log("Attempting to save settings:", settings);
  const db = await getSqliteDb();

  try {
    console.log("Database opened successfully");
    const result = await db.run(
      `
      INSERT OR REPLACE INTO settings (
        id, systemPrompt 
      ) VALUES (
        1, ? 
      )
    `,
      [
        settings.systemPrompt,
      ]
    );
    console.log("Query executed successfully:", result);
  } catch (error) {
    console.error("Error in saveSettings:", error);
    throw error;
  }
}

export async function getDatabaseConnections(): Promise<DatabaseConnection[]> {
  const db = await getSqliteDb();
  return db.all<DatabaseConnection[]>("SELECT * FROM database_connections");
}

export async function saveDatabaseConnection(connection: DatabaseConnection): Promise<void> {
  const db = await getSqliteDb();
  
  try {
    if (connection.id) {
      // Update existing connection
      await db.run(
        `
        UPDATE database_connections SET
        projectName = ?, dbDriver = ?, dbHost = ?, dbPort = ?,
        dbUsername = ?, dbPassword = ?, dbName = ?, schema = ?
        WHERE id = ?
        `,
        [
          connection.projectName, connection.dbDriver, connection.dbHost,
          connection.dbPort, connection.dbUsername, connection.dbPassword,
          connection.dbName, connection.schema, connection.id
        ]
      );
    } else {
      // Insert new connection
      await db.run(
        `
        INSERT INTO database_connections (
          projectName, dbDriver, dbHost, dbPort, dbUsername, dbPassword, dbName, schema
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          connection.projectName, connection.dbDriver, connection.dbHost,
          connection.dbPort, connection.dbUsername, connection.dbPassword,
          connection.dbName, connection.schema
        ]
      );
    }
  } catch (error) {
    console.error("Error in saveDatabaseConnection:", error);
    throw error;
  }
}

export async function deleteDatabaseConnection(id: number): Promise<void> {
  const db = await getSqliteDb();
  
  try {
    await db.run("DELETE FROM database_connections WHERE id = ?", [id]);
  } catch (error) {
    console.error("Error in deleteDatabaseConnection:", error);
    throw error;
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

export async function executeQuery(sql: string, connectionId: number): Promise<any[]> {
  const connections = await getDatabaseConnections();
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