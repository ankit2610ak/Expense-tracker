/**
 * Netlify Function: Auth
 * Handles: POST /api/auth/register
 *          POST /api/auth/login
 *          GET  /api/auth/me
 *          PUT  /api/auth/settings
 */
import type { Config } from '@netlify/functions';
import bcrypt from 'bcryptjs';
import {
  generateToken,
  getAuthUserId,
  unauthorizedResponse,
} from './_shared/auth.js';
import {
  getUserByEmail,
  createUser,
  getUserById,
  getSettings,
  upsertSettings,
} from './_shared/db.js';

// Robust bcrypt methods for ESM / CJS interop
const bcryptHash = (bcrypt as any).hash || (bcrypt as any).default?.hash;
const bcryptCompare = (bcrypt as any).compare || (bcrypt as any).default?.compare;

export const config: Config = {
  path: ['/api/auth', '/api/auth/*'],
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1]; // 'register' | 'login' | 'me' | 'settings'

  try {
    // ── POST /api/auth/register ───────────────────────────────────────────────
    if (action === 'register' && req.method === 'POST') {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { email, password, name, initial_opening_balance = 0, currency = 'INR' } = body as Record<string, string | number>;

      if (!email || !password || !name) {
        return Response.json({ error: 'Name, email, and password are required' }, { status: 400 });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const existing = await getUserByEmail(normalizedEmail);
      if (existing) {
        return Response.json({ error: 'User with this email already exists' }, { status: 409 });
      }

      const password_hash = await bcryptHash(String(password), 10);
      const user = await createUser({
        email: normalizedEmail,
        password_hash,
        name: String(name).trim()
      });

      const initialBal = Number(initial_opening_balance) || 0;
      const curr = String(currency || 'INR').trim().toUpperCase();

      await upsertSettings(user.id, {
        initial_opening_balance: initialBal,
        currency: curr,
      });

      const token = generateToken({ userId: user.id, email: user.email });

      return Response.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
          initial_opening_balance: initialBal,
          currency: curr,
        },
      }, { status: 201 });
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────────
    if (action === 'login' && req.method === 'POST') {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { email, password } = body as Record<string, string>;
      if (!email || !password) {
        return Response.json({ error: 'Email and password are required' }, { status: 400 });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await getUserByEmail(normalizedEmail);
      if (!user) {
        return Response.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      const isMatch = await bcryptCompare(String(password), user.password_hash);
      if (!isMatch) {
        return Response.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      const token = generateToken({ userId: user.id, email: user.email });
      const settings = await getSettings(user.id);

      return Response.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
          initial_opening_balance: settings.initial_opening_balance,
          currency: settings.currency,
        },
      });
    }

    // ── GET /api/auth/me ──────────────────────────────────────────────────────
    if (action === 'me' && req.method === 'GET') {
      const userId = getAuthUserId(req);
      if (!userId) return unauthorizedResponse();

      const user = await getUserById(userId);
      if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

      const settings = await getSettings(userId);
      return Response.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
          initial_opening_balance: settings.initial_opening_balance,
          currency: settings.currency,
        },
      });
    }

    // ── PUT /api/auth/settings ────────────────────────────────────────────────
    if (action === 'settings' && req.method === 'PUT') {
      const userId = getAuthUserId(req);
      if (!userId) return unauthorizedResponse();

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { initial_opening_balance, currency } = body as Record<string, string | number>;
      const updated = await upsertSettings(userId, {
        initial_opening_balance: initial_opening_balance !== undefined ? Number(initial_opening_balance) : undefined,
        currency: currency ? String(currency) : undefined,
      });

      return Response.json({
        message: 'Settings updated successfully',
        settings: updated,
      });
    }

    return Response.json({ error: `Not found: ${req.method} ${url.pathname}` }, { status: 404 });
  } catch (err: any) {
    console.error('Auth function error:', err);
    return Response.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
