import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Balances & Dashboard Analytics Engine', () => {
  let token = '';

  beforeAll(async () => {
    // Register user with 1000 initial opening balance
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Bob Balance',
      email: 'bob@example.com',
      password: 'Password123!',
      initial_opening_balance: 1000,
      currency: 'USD'
    });
    token = regRes.body.token;

    // Get categories
    const catRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);

    const expCat = catRes.body.categories.find((c: any) => c.type === 'expense').id;
    const crCat = catRes.body.categories.find((c: any) => c.type === 'credit').id;

    // 1. Prior transactions (in October 2026)
    // Credit +500
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: crCat,
        type: 'credit',
        amount: 500,
        description: 'Oct Freelance',
        date: '2026-10-15'
      });

    // Expense -200
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: expCat,
        type: 'expense',
        amount: 200,
        description: 'Oct Supplies',
        date: '2026-10-20'
      });

    // 2. Current month transactions (November 2026)
    // Expense -150
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: expCat,
        type: 'expense',
        amount: 150,
        description: 'Nov Groceries',
        date: '2026-11-02'
      });

    // Credit +400
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: crCat,
        type: 'credit',
        amount: 400,
        description: 'Nov Bonus',
        date: '2026-11-05'
      });
  });

  it('accurately computes monthly opening balance, credits, expenses, and closing balance', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary?period=month&date=2026-11-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { summary, timeSeries, categoryBreakdown } = res.body;

    // Opening Balance for Nov:
    // Initial baseline (1000) + Oct credits (500) - Oct expenses (200) = 1300
    expect(summary.opening_balance).toBe(1300);

    // Nov Period Totals:
    expect(summary.total_expenses).toBe(150);
    expect(summary.total_credits).toBe(400);

    // Closing Balance: 1300 + 400 - 150 = 1550
    expect(summary.closing_balance).toBe(1550);

    // Time series for month should be present
    expect(timeSeries.length).toBeGreaterThan(0);

    // Category breakdown should have 1 expense category
    expect(categoryBreakdown.length).toBe(1);
    expect(categoryBreakdown[0].total).toBe(150);
    expect(categoryBreakdown[0].percentage).toBe(100);
  });

  it('accurately computes weekly summary', async () => {
    // 2026-11-04 is a Wednesday.
    // Monday is 2026-11-02.
    // Sunday is 2026-11-08.
    const res = await request(app)
      .get('/api/dashboard/summary?period=week&date=2026-11-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { summary, timeSeries } = res.body;

    // Both Nov 2 and Nov 5 transactions fall inside this week
    expect(summary.total_expenses).toBe(150);
    expect(summary.total_credits).toBe(400);

    // Time series should have 7 days
    expect(timeSeries.length).toBe(7);
  });

  it('accurately computes 12-month summary with 12 monthly time series points', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary?period=year&date=2026-11-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { summary, timeSeries } = res.body;

    expect(summary.period).toBe('year');
    // Both October (500 credit, 200 expense) and November (400 credit, 150 expense) fall into the 12-month window
    expect(summary.total_expenses).toBe(350);
    expect(summary.total_credits).toBe(900);
    expect(timeSeries.length).toBe(12);
  });

  it('updates settings and reflects new initial opening balance', async () => {
    await request(app)
      .put('/api/auth/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        initial_opening_balance: 2000,
        currency: 'EUR'
      });

    const res = await request(app)
      .get('/api/dashboard/summary?period=month&date=2026-11-04')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Opening balance should now be 2000 + 300 = 2300
    expect(res.body.summary.opening_balance).toBe(2300);
    // Closing balance: 2300 + 400 - 150 = 2550
    expect(res.body.summary.closing_balance).toBe(2550);
    expect(res.body.summary.currency).toBe('EUR');
  });
});

