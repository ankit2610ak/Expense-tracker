import { describe, it, expect, beforeEach } from 'vitest';
import authHandler from '../../netlify/functions/auth.mts';
import { resetAllStores } from '../../netlify/functions/_shared/db';
import { generateToken } from '../../netlify/functions/_shared/auth';

describe('Integration: Netlify Function Auth Handler', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('handles CORS OPTIONS preflight', async () => {
    const req = new Request('http://localhost/api/auth/register', { method: 'OPTIONS' });
    const res = await authHandler(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user and returns token + user profile with INR default', async () => {
      const body = {
        name: 'Ankit Test',
        email: 'ankit.test@example.com',
        password: 'Password123!',
        initial_opening_balance: 15000,
        currency: 'INR',
      };

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const res = await authHandler(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.name).toBe('Ankit Test');
      expect(data.user.email).toBe('ankit.test@example.com');
      expect(data.user.initial_opening_balance).toBe(15000);
      expect(data.user.currency).toBe('INR');
    });

    it('validates required fields on register', async () => {
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'missing@example.com' }), // missing name & password
      });

      const res = await authHandler(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe('Name, email, and password are required');
    });

    it('rejects duplicate email registration with 409', async () => {
      const body = {
        name: 'User One',
        email: 'duplicate@example.com',
        password: 'Password123!',
      };

      const req1 = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const res1 = await authHandler(req1);
      expect(res1.status).toBe(201);

      // Attempt second registration with same email
      const req2 = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const res2 = await authHandler(req2);
      expect(res2.status).toBe(409);

      const data = await res2.json();
      expect(data.error).toBe('User with this email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates user with valid credentials', async () => {
      // Register first
      const regReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Login User',
          email: 'login@example.com',
          password: 'SecretPassword123',
        }),
      });
      await authHandler(regReq);

      // Login
      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'login@example.com',
          password: 'SecretPassword123',
        }),
      });

      const loginRes = await authHandler(loginReq);
      expect(loginRes.status).toBe(200);

      const data = await loginRes.json();
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe('login@example.com');
    });

    it('rejects login with wrong password (401)', async () => {
      const regReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User',
          email: 'wrongpass@example.com',
          password: 'CorrectPassword123',
        }),
      });
      await authHandler(regReq);

      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'wrongpass@example.com',
          password: 'WrongPassword!',
        }),
      });

      const res = await authHandler(loginReq);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid email or password');
    });

    it('rejects login for non-existent email (401)', async () => {
      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'doesnotexist@example.com',
          password: 'SomePassword',
        }),
      });

      const res = await authHandler(loginReq);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user profile with valid token', async () => {
      const regReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Profile User',
          email: 'profile@example.com',
          password: 'Password123',
          initial_opening_balance: 5000,
        }),
      });
      const regRes = await authHandler(regReq);
      const { token } = await regRes.json();

      const meReq = new Request('http://localhost/api/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const meRes = await authHandler(meReq);
      expect(meRes.status).toBe(200);

      const meData = await meRes.json();
      expect(meData.user.name).toBe('Profile User');
      expect(meData.user.initial_opening_balance).toBe(5000);
      expect(meData.user.currency).toBe('INR');
    });

    it('rejects unauthenticated request with 401', async () => {
      const meReq = new Request('http://localhost/api/auth/me', { method: 'GET' });
      const res = await authHandler(meReq);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/auth/settings', () => {
    it('updates user settings and reflects changes', async () => {
      const regReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Settings User',
          email: 'settings@example.com',
          password: 'Password123',
        }),
      });
      const regRes = await authHandler(regReq);
      const { token } = await regRes.json();

      const updateReq = new Request('http://localhost/api/auth/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          initial_opening_balance: 50000,
          currency: 'INR',
        }),
      });

      const updateRes = await authHandler(updateReq);
      expect(updateRes.status).toBe(200);

      const updateData = await updateRes.json();
      expect(updateData.settings.initial_opening_balance).toBe(50000);
      expect(updateData.settings.currency).toBe('INR');
    });
  });
});

