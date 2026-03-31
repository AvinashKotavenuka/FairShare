import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.ts';

const sqlite = new Database('splitwise_v3.db');
export const db = drizzle(sqlite, { schema });

// Initialize database tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    avatar TEXT
  );
`);

// Migration: Add username column if missing
try {
  const tableInfo = sqlite.prepare("PRAGMA table_info(users)").all() as any[];
  const hasUsername = tableInfo.some(col => col.name === 'username');
  if (!hasUsername) {
    // SQLite ALTER TABLE ADD COLUMN does not support expressions in DEFAULT.
    // We add it with a constant default first, then update it.
    sqlite.exec("ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT '';");
    sqlite.exec("UPDATE users SET username = 'user_' || id;");
    console.log("Migration: Added username column to users table.");
  }
  const hasPassword = tableInfo.some(col => col.name === 'password');
  if (!hasPassword) {
    sqlite.exec("ALTER TABLE users ADD COLUMN password TEXT;");
    console.log("Migration: Added password column to users table.");
  }
} catch (e) {
  console.error("Migration failed:", e);
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL REFERENCES users(id),
    user2_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'accepted'
  );
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT
  );
  CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    user_id INTEGER NOT NULL REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount TEXT NOT NULL,
    description TEXT NOT NULL,
    payer_id INTEGER NOT NULL REFERENCES users(id),
    group_id INTEGER REFERENCES groups(id),
    category_id INTEGER REFERENCES categories(id),
    receipt_url TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate TEXT NOT NULL DEFAULT '1.0',
    recurring_type TEXT,
    next_occurrence INTEGER,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE TABLE IF NOT EXISTS expense_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expense_id INTEGER NOT NULL REFERENCES expenses(id),
    amount TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER REFERENCES groups(id),
    user1_id INTEGER NOT NULL REFERENCES users(id),
    user2_id INTEGER NOT NULL REFERENCES users(id),
    net_amount TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payer_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    group_id INTEGER REFERENCES groups(id),
    amount TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expense_id INTEGER REFERENCES expenses(id),
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  -- Migration: Add expense_id column if missing (for existing tables)
  -- SQLite doesn't support IF NOT EXISTS for columns, so we handle it in JS
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL REFERENCES expenses(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
`);

// Migration: Add missing columns to expenses table
try {
  const tableInfo = sqlite.prepare("PRAGMA table_info(expenses)").all() as any[];
  const columns = tableInfo.map(col => col.name);
  
  if (!columns.includes('receipt_url')) {
    sqlite.exec("ALTER TABLE expenses ADD COLUMN receipt_url TEXT;");
    console.log("Migration: Added receipt_url column to expenses table.");
  }
  if (!columns.includes('currency')) {
    sqlite.exec("ALTER TABLE expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';");
    console.log("Migration: Added currency column to expenses table.");
  }
  if (!columns.includes('exchange_rate')) {
    sqlite.exec("ALTER TABLE expenses ADD COLUMN exchange_rate TEXT NOT NULL DEFAULT '1.0';");
    console.log("Migration: Added exchange_rate column to expenses table.");
  }
  if (!columns.includes('recurring_type')) {
    sqlite.exec("ALTER TABLE expenses ADD COLUMN recurring_type TEXT;");
    console.log("Migration: Added recurring_type column to expenses table.");
  }
  if (!columns.includes('next_occurrence')) {
    sqlite.exec("ALTER TABLE expenses ADD COLUMN next_occurrence INTEGER;");
    console.log("Migration: Added next_occurrence column to expenses table.");
  }
} catch (e) {
  console.error("Expenses migration failed:", e);
}

  // Migration: Add missing columns to activities table
  try {
    const tableInfo = sqlite.prepare("PRAGMA table_info(activities)").all() as any[];
    const columns = tableInfo.map(col => col.name);
    
    if (!columns.includes('expense_id')) {
      // Use a safer way to add the column if it's missing
      sqlite.exec("ALTER TABLE activities ADD COLUMN expense_id INTEGER REFERENCES expenses(id);");
      console.log("Migration: Added expense_id column to activities table.");
    }
  } catch (e) {
    console.error("Activities migration failed:", e);
  }

// Seed categories if empty
const categoryCount = sqlite.prepare('SELECT count(*) as count FROM categories').get() as { count: number };
if (categoryCount.count === 0) {
  const insertCategory = sqlite.prepare('INSERT INTO categories (name, icon) VALUES (?, ?)');
  const defaultCategories = [
    ['General', 'Tag'],
    ['Food & Drink', 'Utensils'],
    ['Entertainment', 'Gamepad2'],
    ['Home', 'Home'],
    ['Transportation', 'Car'],
    ['Utilities', 'Zap'],
    ['Travel', 'Plane'],
  ];
  defaultCategories.forEach(([name, icon]) => insertCategory.run(name, icon));
}
