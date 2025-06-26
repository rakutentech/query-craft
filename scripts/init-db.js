const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

async function initializeDatabase() {
  const dbPath = path.join(process.cwd(), "query_craft.sqlite");
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  console.log("Initializing database...");
  await db.exec(`
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
      id TEXT PRIMARY KEY,
      conversationId INTEGER,
      content TEXT,
      sender TEXT CHECK(sender IN ('user', 'system')),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      share_token TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
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
      tag TEXT,
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
  console.log("Database initialized successfully");
  await db.close();
}

initializeDatabase().catch((error) => {
  console.error("Error initializing database:", error);
  process.exit(1);
});