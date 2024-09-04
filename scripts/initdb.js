// initdb.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function setup() {
  let db;
  try {
    db = await open({
      filename: './mydb.sqlite',
      driver: sqlite3.Database
    });

    // Enable foreign key support
    await db.exec('PRAGMA foreign_keys = ON;');

    await db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (conversationId) REFERENCES conversations (id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        systemPrompt TEXT
      );

      CREATE TABLE IF NOT EXISTS database_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectName TEXT,
        dbDriver TEXT,
        dbHost TEXT,
        dbPort TEXT,
        dbUsername TEXT,
        dbPassword TEXT,
        dbName TEXT,
        schema TEXT
      );

    `);

    // Check if connectionId column exists in history and add it if it doesn't
    const historyColumns = await db.all("PRAGMA table_info(conversations)");
    const connectionIdColumnExists = historyColumns.some(column => column.name === 'connectionId');
    if (!connectionIdColumnExists) {
      // SQLite doesn't support adding a foreign key constraint to an existing table,
      // so we need to recreate the table
      await db.exec(`
        DROP TABLE conversations_new;
        CREATE TABLE conversations_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          connectionId INTEGER,
          title TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (connectionId) REFERENCES database_connections (id)
        );
        INSERT INTO conversations_new (id, connectionId, title, timestamp)
        SELECT id, 1, title, timestamp FROM conversations;
        DROP TABLE conversations;
        ALTER TABLE conversations_new RENAME TO conversations;
      `);
      console.log("Added 'connectionId' column to history table");
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

setup().catch(error => {
  console.error('Unhandled error during database setup:', error);
  process.exit(1);
});