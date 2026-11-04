import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { seedDefaultCategories } from './seed.js';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

export type DatabaseInstance = InstanceType<typeof DatabaseSync>;

let dbInstance: DatabaseInstance | null = null;

export function getDatabase(dbPath?: string): DatabaseInstance {
  if (dbInstance && !dbPath) {
    return dbInstance;
  }

  const effectivePath = dbPath || process.env.DATABASE_URL || path.resolve(process.cwd(), 'expense_tracker.db');

  if (effectivePath !== ':memory:') {
    const dir = path.dirname(effectivePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(effectivePath);

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');
  if (effectivePath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  initSchema(db);
  seedDefaultCategories(db);

  if (!dbPath) {
    dbInstance = db;
  }

  return db;
}

export function initSchema(db: DatabaseInstance): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      initial_opening_balance REAL DEFAULT 0.0,
      currency TEXT DEFAULT 'INR',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NULL,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('expense', 'credit')) NOT NULL,
      color TEXT DEFAULT '#64748b',
      icon TEXT DEFAULT 'Tag',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('expense', 'credit')) NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
  `);
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
