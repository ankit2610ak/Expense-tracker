import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getDatabase } from '../src/db/database.js';

describe('Auth Endpoints', () => {
  const testUser = {
    name: 'Alice Tester',
    email: 'alice@example.com',
    password: 'Password123!',
    initial_opening_balance: 1500,
    currency: 'USD'
  };

  it('registers a new user with initial opening balance', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.name).toBe(testUser.name);
    expect(res.body.user.initial_opening_balance).toBe(1500);
    expect(res.body.user.currency).toBe('USD');
  });

  it('defaults currency to INR if not specified', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Rohan Sharma',
        email: 'rohan@example.in',
        password: 'Password123!'
      });

    expect(res.status).toBe(201);
    expect(res.body.user.currency).toBe('INR');
  });

  it('rejects duplicate user registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('logs in the user with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword'
      });

    expect(res.status).toBe(401);
  });

  it('returns current user profile on /api/auth/me', async () => {
    // First login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(testUser.email);
    expect(meRes.body.user.initial_opening_balance).toBe(1500);
  });

  it('rejects unauthorized access to /api/auth/me', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});
