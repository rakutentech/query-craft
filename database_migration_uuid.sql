-- Migration script to convert message IDs from INTEGER to UUID (VARCHAR)
-- This script handles both SQLite and MySQL databases

-- For SQLite:
-- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table

-- Step 1: Create new messages table with UUID id
CREATE TABLE IF NOT EXISTS messages_new (
    id VARCHAR(36) PRIMARY KEY,
    conversationId INTEGER NOT NULL,
    content TEXT NOT NULL,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'system')),
    timestamp DATETIME NOT NULL,
    share_token VARCHAR(255)
);

-- Step 2: Copy existing data with generated UUIDs (SQLite)
-- Note: This will generate new UUIDs for existing messages, breaking existing share links
-- If you need to preserve share functionality, you'll need a more complex migration
INSERT INTO messages_new (id, conversationId, content, sender, timestamp, share_token)
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
          substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    conversationId,
    content,
    sender,
    timestamp,
    share_token
FROM messages;

-- Step 3: Drop old table and rename new one (SQLite)
DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

-- For MySQL:
-- MySQL approach: Create new table, copy data, then replace

-- Step 1: Create new messages table with UUID id
CREATE TABLE messages_new (
    id VARCHAR(36) PRIMARY KEY,
    conversationId INT,
    content TEXT,
    sender ENUM('user', 'system'),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    share_token VARCHAR(255) UNIQUE,
    INDEX idx_conversation_messages (conversationId),
    INDEX idx_share_token (share_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Copy existing data with generated UUIDs
INSERT INTO messages_new (id, conversationId, content, sender, timestamp, share_token)
SELECT
    UUID() as id,
    conversationId,
    content,
    sender,
    timestamp,
    share_token
FROM messages;

-- Step 3: Drop old table and rename new one
DROP TABLE messages;
RENAME TABLE messages_new TO messages;

-- Alternative approach for MySQL if you want to preserve existing numeric IDs as strings:
-- UPDATE messages SET id_new = CAST(id as CHAR);

-- Note: After running this migration, you'll need to update any application code
-- that references message IDs to use the new UUID format.

-- Verification queries:
-- SELECT COUNT(*) FROM messages; -- Should match count before migration
-- SELECT id, LENGTH(id) FROM messages LIMIT 5; -- Should show UUID format (36 chars)