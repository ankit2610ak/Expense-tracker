import { describe, it, expect, beforeEach } from 'vitest';
import txHandler from '../../netlify/functions/transactions.mts';
import catHandler from '../../netlify/functions/categories.mts';
import { resetAllStores, createUser } from '../../netlify/functions/_shared/db';
import { generateToken } from '../../netlify/functions/_shared/auth';

describe('Integration: Netlify Function Transactions & Categories Handler', () => {
  let userId: string;
  let token: string;
  let foodCatId: string;
  let salaryCatId: string;

  beforeEach(async () => {
    resetAllStores();

    const user = await createUser({
      name: 'Tx User',
      email: 'tx@example.com',
      password_hash: 'hash',
    });
    userId = user.id;
    token = generateToken({ userId, email: user.email });

    // Fetch seeded categories to get valid category IDs
    const catReq = new Request('http://localhost/api/categories', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const catRes = await catHandler(catReq);
    const catData = await catRes.json();
    foodCatId = catData.categories.find((c: any) => c.name === 'Food & Dining').id;
    salaryCatId = catData.categories.find((c: any) => c.name === 'Salary').id;
  });

  it('creates an expense and a credit transaction', async () => {
    // 1. Create expense
    const expenseReq = new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        category_id: foodCatId,
        type: 'expense',
        amount: 850,
        description: 'Team Lunch',
        date: '2026-11-05',
      }),
    });

    const expRes = await txHandler(expenseReq);
    expect(expRes.status).toBe(201);
    const expData = await expRes.json();
    expect(expData.transaction.amount).toBe(850);
    expect(expData.transaction.category_name).toBe('Food & Dining');

    // 2. Create credit
    const creditReq = new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        category_id: salaryCatId,
        type: 'credit',
        amount: 50000,
        description: 'November Salary',
        date: '2026-11-01',
      }),
    });

    const credRes = await txHandler(creditReq);
    expect(credRes.status).toBe(201);
    const credData = await credRes.json();
    expect(credData.transaction.amount).toBe(50000);
    expect(credData.transaction.type).toBe('credit');
  });

  it('lists transactions and computes totals accurately', async () => {
    // Add 2 expenses and 1 credit
    await txHandler(new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: foodCatId, type: 'expense', amount: 500, date: '2026-11-02' }),
    }));
    await txHandler(new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: foodCatId, type: 'expense', amount: 300, date: '2026-11-03' }),
    }));
    await txHandler(new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: salaryCatId, type: 'credit', amount: 2000, date: '2026-11-01' }),
    }));

    const listReq = new Request('http://localhost/api/transactions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listRes = await txHandler(listReq);
    expect(listRes.status).toBe(200);

    const data = await listRes.json();
    expect(data.transactions.length).toBe(3);
    expect(data.totals.total_expenses).toBe(800);
    expect(data.totals.total_credits).toBe(2000);
    expect(data.totals.net).toBe(1200);
    expect(data.totals.count).toBe(3);
  });

  it('updates an existing transaction', async () => {
    const createRes = await txHandler(new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: foodCatId, type: 'expense', amount: 100, description: 'Snack' }),
    }));
    const { transaction } = await createRes.json();

    const updateReq = new Request(`http://localhost/api/transactions/${transaction.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: 150, description: 'Big Snack' }),
    });

    const updateRes = await txHandler(updateReq);
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.transaction.amount).toBe(150);
    expect(updateData.transaction.description).toBe('Big Snack');
  });

  it('deletes an existing transaction', async () => {
    const createRes = await txHandler(new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: foodCatId, type: 'expense', amount: 200 }),
    }));
    const { transaction } = await createRes.json();

    const delReq = new Request(`http://localhost/api/transactions/${transaction.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const delRes = await txHandler(delReq);
    expect(delRes.status).toBe(200);
    const delData = await delRes.json();
    expect(delData.id).toBe(transaction.id);

    // Verify deleted
    const listRes = await txHandler(new Request('http://localhost/api/transactions', {
      headers: { Authorization: `Bearer ${token}` },
    }));
    const listData = await listRes.json();
    expect(listData.transactions.length).toBe(0);
  });
});
