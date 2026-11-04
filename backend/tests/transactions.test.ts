import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Transactions & Categories API', () => {
  let userAToken = '';
  let userBToken = '';
  let expenseCategory = '';
  let creditCategory = '';
  let createdTxId = '';

  beforeAll(async () => {
    // Register user A
    const resA = await request(app).post('/api/auth/register').send({
      name: 'User A',
      email: 'usera@example.com',
      password: 'Password123!',
      initial_opening_balance: 500
    });
    userAToken = resA.body.token;

    // Register user B
    const resB = await request(app).post('/api/auth/register').send({
      name: 'User B',
      email: 'userb@example.com',
      password: 'Password123!',
      initial_opening_balance: 1000
    });
    userBToken = resB.body.token;

    // Fetch categories
    const catRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${userAToken}`);

    const exp = catRes.body.categories.find((c: any) => c.type === 'expense');
    const cr = catRes.body.categories.find((c: any) => c.type === 'credit');
    expenseCategory = exp.id;
    creditCategory = cr.id;
  });

  it('fetches seeded default categories', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBeGreaterThan(5);
  });

  it('allows creating a custom category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'Pet Care',
        type: 'expense',
        color: '#ff5722',
        icon: 'PawPrint'
      });

    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe('Pet Care');
  });

  it('creates an expense transaction', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category_id: expenseCategory,
        type: 'expense',
        amount: 45.5,
        description: 'Dinner with friends',
        date: '2026-11-04'
      });

    expect(res.status).toBe(201);
    expect(res.body.transaction.amount).toBe(45.5);
    expect(res.body.transaction.type).toBe('expense');
    expect(res.body.transaction.category_name).toBeDefined();
    createdTxId = res.body.transaction.id;
  });

  it('creates a credit (income) transaction', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category_id: creditCategory,
        type: 'credit',
        amount: 1200,
        description: 'Bi-weekly paycheck',
        date: '2026-11-04'
      });

    expect(res.status).toBe(201);
    expect(res.body.transaction.amount).toBe(1200);
    expect(res.body.transaction.type).toBe('credit');
  });

  it('rejects invalid transaction data', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category_id: expenseCategory,
        type: 'expense',
        amount: -20, // Negative amount not allowed
        date: '2026-11-04'
      });

    expect(res.status).toBe(400);
  });

  it('enforces privacy: User B cannot see User A transactions', async () => {
    const resB = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.transactions.length).toBe(0);
    expect(resB.body.totals.total_expenses).toBe(0);
  });

  it('filters transactions by type', async () => {
    const res = await request(app)
      .get('/api/transactions?type=expense')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions.every((t: any) => t.type === 'expense')).toBe(true);
    expect(res.body.totals.total_expenses).toBe(45.5);
  });

  it('filters transactions by category', async () => {
    const res = await request(app)
      .get(`/api/transactions?category_id=${expenseCategory}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions.every((t: any) => t.category_id === expenseCategory)).toBe(true);
  });

  it('updates an existing transaction', async () => {
    const res = await request(app)
      .put(`/api/transactions/${createdTxId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        amount: 55.0,
        description: 'Dinner with colleagues'
      });

    expect(res.status).toBe(200);
    expect(res.body.transaction.amount).toBe(55.0);
    expect(res.body.transaction.description).toBe('Dinner with colleagues');
  });

  it('deletes an existing transaction', async () => {
    const res = await request(app)
      .delete(`/api/transactions/${createdTxId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);

    // Verify it is gone
    const listRes = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(listRes.body.transactions.find((t: any) => t.id === createdTxId)).toBeUndefined();
  });
});

