/**
 * Resilient Data layer for Netlify Functions.
 * Uses @netlify/blobs when available, with automatic in-memory fallback
 * when running locally, in unit tests, or if Netlify Blobs is unconfigured.
 */

import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
import { DEFAULT_CATEGORIES } from './seed.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

export interface SettingsRecord {
  user_id: string;
  initial_opening_balance: number;
  currency: string;
  updated_at: string;
}

export interface CategoryRecord {
  id: string;
  user_id: string | null; // null = default/global
  name: string;
  type: 'expense' | 'credit';
  color: string;
  icon: string;
}

export interface TransactionRecord {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  type: 'expense' | 'credit';
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface KVStore {
  get(key: string, options?: { type?: 'json' | 'text' }): Promise<any>;
  set(key: string, data: string): Promise<void>;
  delete(key: string): Promise<void>;
}

// ─── Resilient Store Implementation ──────────────────────────────────────────

const fallbackMemoryStores = new Map<string, Map<string, string>>();

export function getFallbackMemoryStore(name: string): KVStore {
  if (!fallbackMemoryStores.has(name)) {
    fallbackMemoryStores.set(name, new Map());
  }
  const map = fallbackMemoryStores.get(name)!;
  return {
    async get(key: string, options?: { type?: 'json' | 'text' }) {
      const val = map.get(key);
      if (val === undefined || val === null) return null;
      if (options?.type === 'json') {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return val;
    },
    async set(key: string, data: string) {
      map.set(key, data);
    },
    async delete(key: string) {
      map.delete(key);
    }
  };
}

export function resetAllStores(): void {
  fallbackMemoryStores.clear();
}

function getSafeStore(name: string): KVStore {
  try {
    const blobStore = getStore(name);
    const memory = getFallbackMemoryStore(name);

    return {
      async get(key: string, options?: { type?: 'json' | 'text' }) {
        try {
          return await (blobStore as any).get(key, options);
        } catch (err: any) {
          if (err?.message?.includes('not been configured') || err?.message?.includes('Missing environment variable')) {
            return memory.get(key, options);
          }
          throw err;
        }
      },
      async set(key: string, data: string) {
        try {
          await blobStore.set(key, data);
        } catch (err: any) {
          if (err?.message?.includes('not been configured') || err?.message?.includes('Missing environment variable')) {
            return memory.set(key, data);
          }
          throw err;
        }
      },
      async delete(key: string) {
        try {
          await blobStore.delete(key);
        } catch (err: any) {
          if (err?.message?.includes('not been configured') || err?.message?.includes('Missing environment variable')) {
            return memory.delete(key);
          }
          throw err;
        }
      }
    };
  } catch {
    return getFallbackMemoryStore(name);
  }
}

// Store accessors
function usersStore() { return getSafeStore('users'); }
function emailsStore() { return getSafeStore('user-emails'); }
function settingsStore() { return getSafeStore('user-settings'); }
function categoriesStore() { return getSafeStore('categories'); }
function transactionsStore() { return getSafeStore('transactions'); }

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const store = usersStore();
  const raw = await store.get(userId, { type: 'json' });
  return raw as UserRecord | null;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const store = emailsStore();
  const userId = await store.get(email.toLowerCase(), { type: 'text' });
  if (!userId) return null;
  return getUserById(userId);
}

export async function createUser(data: {
  email: string;
  password_hash: string;
  name: string;
}): Promise<UserRecord> {
  const userId = randomUUID();
  const user: UserRecord = {
    id: userId,
    email: data.email.toLowerCase(),
    password_hash: data.password_hash,
    name: data.name.trim(),
    created_at: new Date().toISOString(),
  };
  await usersStore().set(userId, JSON.stringify(user));
  await emailsStore().set(user.email, userId);
  return user;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSettings(userId: string): Promise<SettingsRecord> {
  const store = settingsStore();
  const raw = await store.get(userId, { type: 'json' });
  if (raw) return raw as SettingsRecord;
  return {
    user_id: userId,
    initial_opening_balance: 0,
    currency: 'INR',
    updated_at: new Date().toISOString()
  };
}

export async function upsertSettings(userId: string, data: { initial_opening_balance?: number; currency?: string }): Promise<SettingsRecord> {
  const current = await getSettings(userId);
  const updated: SettingsRecord = {
    user_id: userId,
    initial_opening_balance: data.initial_opening_balance !== undefined ? Number(data.initial_opening_balance) : current.initial_opening_balance,
    currency: data.currency ? String(data.currency).trim().toUpperCase() : current.currency,
    updated_at: new Date().toISOString(),
  };
  await settingsStore().set(userId, JSON.stringify(updated));
  return updated;
}

// ─── Categories ──────────────────────────────────────────────────────────────

async function ensureDefaultCategories(): Promise<CategoryRecord[]> {
  const store = categoriesStore();
  const existing = await store.get('defaults', { type: 'json' }) as CategoryRecord[] | null;
  if (existing && existing.length > 0) return existing;

  const defaults: CategoryRecord[] = DEFAULT_CATEGORIES.map(c => ({
    id: randomUUID(),
    user_id: null,
    name: c.name,
    type: c.type,
    color: c.color,
    icon: c.icon,
  }));

  await Promise.all(defaults.map(cat => store.set(cat.id, JSON.stringify(cat))));
  await store.set('defaults', JSON.stringify(defaults));
  return defaults;
}

export async function listCategories(userId: string, typeFilter?: 'expense' | 'credit'): Promise<CategoryRecord[]> {
  const store = categoriesStore();
  const defaults = await ensureDefaultCategories();

  const userIndexRaw = await store.get(`idx:${userId}`, { type: 'json' }) as string[] | null;
  const userCatIds: string[] = userIndexRaw || [];
  const userCats = await Promise.all(
    userCatIds.map(id => store.get(id, { type: 'json' }) as Promise<CategoryRecord | null>)
  );
  const validUserCats = userCats.filter(Boolean) as CategoryRecord[];

  let all = [...defaults, ...validUserCats];
  if (typeFilter) {
    all = all.filter(c => c.type === typeFilter);
  }
  all.sort((a, b) => {
    if (a.user_id === null && b.user_id !== null) return -1;
    if (a.user_id !== null && b.user_id === null) return 1;
    return a.name.localeCompare(b.name);
  });
  return all;
}

export async function createCategory(userId: string, data: {
  name: string;
  type: 'expense' | 'credit';
  color?: string;
  icon?: string;
}): Promise<CategoryRecord> {
  const store = categoriesStore();
  const id = randomUUID();
  const cat: CategoryRecord = {
    id,
    user_id: userId,
    name: String(data.name).trim(),
    type: data.type,
    color: data.color || '#64748b',
    icon: data.icon || 'Tag',
  };
  await store.set(id, JSON.stringify(cat));

  const idxKey = `idx:${userId}`;
  const existing = await store.get(idxKey, { type: 'json' }) as string[] | null;
  const ids = existing || [];
  ids.push(id);
  await store.set(idxKey, JSON.stringify(ids));
  return cat;
}

export async function getCategoryById(categoryId: string): Promise<CategoryRecord | null> {
  const store = categoriesStore();
  const raw = await store.get(categoryId, { type: 'json' });
  return raw as CategoryRecord | null;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

function txKey(userId: string, txId: string) { return `${userId}:${txId}`; }
function txIndexKey(userId: string) { return `idx:${userId}`; }

async function getUserTxIds(userId: string): Promise<string[]> {
  const store = transactionsStore();
  const raw = await store.get(txIndexKey(userId), { type: 'json' }) as string[] | null;
  return raw || [];
}

async function saveUserTxIds(userId: string, ids: string[]): Promise<void> {
  await transactionsStore().set(txIndexKey(userId), JSON.stringify(ids));
}

export async function listTransactions(userId: string, filters?: {
  type?: string;
  category_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ transactions: TransactionRecord[]; totals: { total_expenses: number; total_credits: number; net: number; count: number } }> {
  const store = transactionsStore();
  const ids = await getUserTxIds(userId);

  if (ids.length === 0) {
    return { transactions: [], totals: { total_expenses: 0, total_credits: 0, net: 0, count: 0 } };
  }

  const rawTxs = await Promise.all(ids.map(id => store.get(txKey(userId, id), { type: 'json' }) as Promise<TransactionRecord | null>));
  let txs = rawTxs.filter(Boolean) as TransactionRecord[];

  if (filters?.type && filters.type !== 'all') {
    txs = txs.filter(t => t.type === filters.type);
  }
  if (filters?.category_id && filters.category_id !== 'all') {
    txs = txs.filter(t => t.category_id === filters.category_id);
  }
  if (filters?.start_date) {
    txs = txs.filter(t => t.date >= filters.start_date!);
  }
  if (filters?.end_date) {
    txs = txs.filter(t => t.date <= filters.end_date!);
  }
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    txs = txs.filter(t => t.description.toLowerCase().includes(term) || t.category_name.toLowerCase().includes(term));
  }

  txs.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return b.created_at.localeCompare(a.created_at);
  });

  const total_expenses = txs.reduce((sum, t) => t.type === 'expense' ? sum + t.amount : sum, 0);
  const total_credits  = txs.reduce((sum, t) => t.type === 'credit'  ? sum + t.amount : sum, 0);

  const limit = filters?.limit ?? 200;
  const offset = filters?.offset ?? 0;
  const paginated = txs.slice(offset, offset + limit);

  return {
    transactions: paginated,
    totals: {
      total_expenses: Number(total_expenses.toFixed(2)),
      total_credits: Number(total_credits.toFixed(2)),
      net: Number((total_credits - total_expenses).toFixed(2)),
      count: txs.length
    },
  };
}

export async function createTransaction(userId: string, data: {
  category_id: string;
  type: 'expense' | 'credit';
  amount: number;
  description?: string;
  date?: string;
}): Promise<TransactionRecord> {
  const store = transactionsStore();

  const cat = await getCategoryById(data.category_id);
  if (!cat) throw new Error('Category not found');

  const id = randomUUID();
  const tx: TransactionRecord = {
    id,
    user_id: userId,
    category_id: data.category_id,
    category_name: cat.name,
    category_color: cat.color,
    category_icon: cat.icon,
    type: data.type,
    amount: data.amount,
    description: (data.description || '').trim(),
    date: data.date || new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await store.set(txKey(userId, id), JSON.stringify(tx));

  const ids = await getUserTxIds(userId);
  ids.push(id);
  await saveUserTxIds(userId, ids);

  return tx;
}

export async function getTransactionById(userId: string, txId: string): Promise<TransactionRecord | null> {
  const store = transactionsStore();
  const raw = await store.get(txKey(userId, txId), { type: 'json' });
  return raw as TransactionRecord | null;
}

export async function updateTransaction(userId: string, txId: string, data: {
  category_id?: string;
  type?: 'expense' | 'credit';
  amount?: number;
  description?: string;
  date?: string;
}): Promise<TransactionRecord | null> {
  const store = transactionsStore();
  const existing = await getTransactionById(userId, txId);
  if (!existing) return null;

  let category_name = existing.category_name;
  let category_color = existing.category_color;
  let category_icon = existing.category_icon;

  if (data.category_id && data.category_id !== existing.category_id) {
    const cat = await getCategoryById(data.category_id);
    if (cat) {
      category_name = cat.name;
      category_color = cat.color;
      category_icon = cat.icon;
    }
  }

  const updated: TransactionRecord = {
    ...existing,
    category_id: data.category_id ?? existing.category_id,
    category_name,
    category_color,
    category_icon,
    type: data.type ?? existing.type,
    amount: data.amount !== undefined ? data.amount : existing.amount,
    description: data.description !== undefined ? data.description.trim() : existing.description,
    date: data.date ?? existing.date,
    updated_at: new Date().toISOString(),
  };

  await store.set(txKey(userId, txId), JSON.stringify(updated));
  return updated;
}

export async function deleteTransaction(userId: string, txId: string): Promise<boolean> {
  const store = transactionsStore();
  const existing = await getTransactionById(userId, txId);
  if (!existing) return false;

  await store.delete(txKey(userId, txId));

  const ids = await getUserTxIds(userId);
  const filtered = ids.filter(id => id !== txId);
  await saveUserTxIds(userId, filtered);
  return true;
}

export async function getAllTransactionsForUser(userId: string): Promise<TransactionRecord[]> {
  const store = transactionsStore();
  const ids = await getUserTxIds(userId);
  if (ids.length === 0) return [];
  const raws = await Promise.all(ids.map(id => store.get(txKey(userId, id), { type: 'json' }) as Promise<TransactionRecord | null>));
  return raws.filter(Boolean) as TransactionRecord[];
}
