import { describe, it, expect, beforeEach } from 'vitest';
import {
  createUser,
  getUserById,
  getUserByEmail,
  getSettings,
  upsertSettings,
  listCategories,
  createCategory,
  createTransaction,
  listTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getAllTransactionsForUser,
  resetAllStores,
} from '../../netlify/functions/_shared/db';

describe('Unit: Netlify Functions DB Layer', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('User Operations', () => {
    it('creates and retrieves a user by ID and email', async () => {
      const user = await createUser({
        name: 'Ankit Tiwari',
        email: 'ankit@example.com',
        password_hash: 'hashed_password_123',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('ankit@example.com');
      expect(user.name).toBe('Ankit Tiwari');

      const byId = await getUserById(user.id);
      expect(byId?.id).toBe(user.id);
      expect(byId?.email).toBe('ankit@example.com');

      const byEmail = await getUserByEmail('ANKIT@example.com'); // case-insensitive
      expect(byEmail?.id).toBe(user.id);
    });

    it('returns null for non-existent user', async () => {
      const user = await getUserById('non-existent-id');
      expect(user).toBeNull();

      const byEmail = await getUserByEmail('unknown@example.com');
      expect(byEmail).toBeNull();
    });
  });

  describe('Settings Operations', () => {
    it('returns default INR settings if not yet set', async () => {
      const settings = await getSettings('user-defaults');
      expect(settings.user_id).toBe('user-defaults');
      expect(settings.currency).toBe('INR');
      expect(settings.initial_opening_balance).toBe(0);
    });

    it('updates user settings and persists them', async () => {
      await upsertSettings('user-1', {
        initial_opening_balance: 25000,
        currency: 'INR',
      });

      const updated = await getSettings('user-1');
      expect(updated.initial_opening_balance).toBe(25000);
      expect(updated.currency).toBe('INR');
    });
  });

  describe('Categories Operations', () => {
    it('automatically seeds default categories (16 total)', async () => {
      const cats = await listCategories('user-1');
      expect(cats.length).toBeGreaterThanOrEqual(16);

      const food = cats.find(c => c.name === 'Food & Dining');
      expect(food).toBeDefined();
      expect(food?.type).toBe('expense');
      expect(food?.user_id).toBeNull();

      const salary = cats.find(c => c.name === 'Salary');
      expect(salary).toBeDefined();
      expect(salary?.type).toBe('credit');
    });

    it('filters categories by type', async () => {
      const expenses = await listCategories('user-1', 'expense');
      expect(expenses.every(c => c.type === 'expense')).toBe(true);

      const credits = await listCategories('user-1', 'credit');
      expect(credits.every(c => c.type === 'credit')).toBe(true);
    });

    it('creates custom user category', async () => {
      const custom = await createCategory('user-1', {
        name: 'Gym & Fitness',
        type: 'expense',
        color: '#10b981',
        icon: 'Activity',
      });

      expect(custom.id).toBeDefined();
      expect(custom.user_id).toBe('user-1');
      expect(custom.name).toBe('Gym & Fitness');

      const userCats = await listCategories('user-1');
      const found = userCats.find(c => c.name === 'Gym & Fitness');
      expect(found).toBeDefined();
    });
  });

  describe('Transactions Operations', () => {
    it('creates and lists transactions with totals', async () => {
      const cats = await listCategories('user-1');
      const foodCat = cats.find(c => c.type === 'expense')!;
      const salaryCat = cats.find(c => c.type === 'credit')!;

      const tx1 = await createTransaction('user-1', {
        category_id: foodCat.id,
        type: 'expense',
        amount: 500,
        description: 'Dinner',
        date: '2026-11-01',
      });

      const tx2 = await createTransaction('user-1', {
        category_id: salaryCat.id,
        type: 'credit',
        amount: 25000,
        description: 'Monthly Salary',
        date: '2026-11-02',
      });

      expect(tx1.id).toBeDefined();
      expect(tx2.id).toBeDefined();

      const result = await listTransactions('user-1');
      expect(result.transactions.length).toBe(2);
      expect(result.totals.total_expenses).toBe(500);
      expect(result.totals.total_credits).toBe(25000);
      expect(result.totals.net).toBe(24500);
    });

    it('updates and deletes a transaction', async () => {
      const cats = await listCategories('user-1');
      const foodCat = cats.find(c => c.type === 'expense')!;

      const tx = await createTransaction('user-1', {
        category_id: foodCat.id,
        type: 'expense',
        amount: 300,
        description: 'Coffee',
        date: '2026-11-01',
      });

      const updated = await updateTransaction('user-1', tx.id, {
        amount: 350,
        description: 'Coffee & Snack',
      });
      expect(updated?.amount).toBe(350);
      expect(updated?.description).toBe('Coffee & Snack');

      const deleted = await deleteTransaction('user-1', tx.id);
      expect(deleted).toBe(true);

      const check = await getTransactionById('user-1', tx.id);
      expect(check).toBeNull();
    });

    it('isolates transactions between different users', async () => {
      const cats = await listCategories('user-1');
      const cat = cats[0];

      await createTransaction('user-A', {
        category_id: cat.id,
        type: 'expense',
        amount: 100,
        description: 'Private A',
      });

      await createTransaction('user-B', {
        category_id: cat.id,
        type: 'expense',
        amount: 200,
        description: 'Private B',
      });

      const listA = await listTransactions('user-A');
      expect(listA.transactions.length).toBe(1);
      expect(listA.transactions[0].description).toBe('Private A');

      const listB = await listTransactions('user-B');
      expect(listB.transactions.length).toBe(1);
      expect(listB.transactions[0].description).toBe('Private B');
    });
  });
});

