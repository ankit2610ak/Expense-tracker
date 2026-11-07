import { describe, it, expect, beforeEach } from 'vitest';
import dashHandler from '../../netlify/functions/dashboard.mts';
import txHandler from '../../netlify/functions/transactions.mts';
import catHandler from '../../netlify/functions/categories.mts';
import authHandler from '../../netlify/functions/auth.mts';
import { resetAllStores } from '../../netlify/functions/_shared/db';

describe('Integration: Netlify Function Dashboard Analytics Handler', () => {
  let token: string;
  let foodCatId: string;
  let salaryCatId: string;

  beforeEach(async () => {
    resetAllStores();

    // Register user with initial opening balance of 10,000 INR
    const regRes = await authHandler(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dashboard User',
        email: 'dash@example.com',
        password: 'Password123',
        initial_opening_balance: 10000,
        currency: 'INR',
      }),
    }));
    const regData = await regRes.json();
    token = regData.token;

    // Get categories
    const catRes = await catHandler(new Request('http://localhost/api/categories', {
      headers: { Authorization: `Bearer ${token}` },
    }));
    const catData = await catRes.json();
    foodCatId = catData.categories.find((c: any) => c.name === 'Food & Dining').id;
    salaryCatId = catData.categories.find((c: any) => c.name === 'Salary').id;
  });

  it('accurately computes opening balance, credits, expenses, and closing balance for month', async () => {
    // Transaction in October 2026 (prior month): credit 5000, expense 1000 -> net +4000
    // Opening balance for November 2026 should be initial (10,000) + 4000 = 14,000!
    await txHandler(new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: salaryCatId, type: 'credit', amount: 5000, date: '2026-10-15' }),
    }));
    await txHandler(new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: foodCatId, type: 'expense', amount: 1000, date: '2026-10-20' }),
    }));

    // Transactions in November 2026: credit 20000, expense 3000
    await txHandler(new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: salaryCatId, type: 'credit', amount: 20000, date: '2026-11-02' }),
    }));
    await txHandler(new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_id: foodCatId, type: 'expense', amount: 3000, date: '2026-11-05' }),
    }));

    // Request dashboard for November 2026
    const dashReq = new Request('http://localhost/api/dashboard/summary?period=month&date=2026-11-07', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dashRes = await dashHandler(dashReq);
    expect(dashRes.status).toBe(200);

    const data = await dashRes.json();
    expect(data.summary.opening_balance).toBe(14000); // 10000 initial + 5000 - 1000 prior
    expect(data.summary.total_credits).toBe(20000);
    expect(data.summary.total_expenses).toBe(3000);
    expect(data.summary.closing_balance).toBe(31000); // 14000 + 20000 - 3000 = 31000
    expect(data.summary.currency).toBe('INR');

    // Category breakdown should contain Food & Dining with 3000 total and 100% of period expense
    expect(data.categoryBreakdown.length).toBeGreaterThanOrEqual(1);
    expect(data.categoryBreakdown[0].name).toBe('Food & Dining');
    expect(data.categoryBreakdown[0].total).toBe(3000);
    expect(data.categoryBreakdown[0].percentage).toBe(100);
  });

  it('accurately computes 12-month rolling summary with 12 monthly points', async () => {
    const dashReq = new Request('http://localhost/api/dashboard/summary?period=year&date=2026-11-07', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dashRes = await dashHandler(dashReq);
    expect(dashRes.status).toBe(200);

    const data = await dashRes.json();
    expect(data.summary.period).toBe('year');
    expect(data.timeSeries.length).toBe(12);
  });
});
