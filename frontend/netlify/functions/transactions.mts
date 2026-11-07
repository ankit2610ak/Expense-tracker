/**
 * Netlify Function: Transactions
 * Handles: GET    /api/transactions
 *          POST   /api/transactions
 *          PUT    /api/transactions/:id
 *          DELETE /api/transactions/:id
 */
import type { Config } from '@netlify/functions';
import { getAuthUserId, unauthorizedResponse } from './_shared/auth.js';
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionById,
} from './_shared/db.js';

export const config: Config = {
  path: ['/api/transactions', '/api/transactions/*'],
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

  const userId = getAuthUserId(req);
  if (!userId) return unauthorizedResponse();

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const txId = (lastPart && lastPart !== 'transactions') ? lastPart : null;

  try {
    // ── GET /api/transactions ─────────────────────────────────────────────────
    if (req.method === 'GET' && !txId) {
      const type = url.searchParams.get('type') || undefined;
      const category_id = url.searchParams.get('category_id') || undefined;
      const start_date = url.searchParams.get('start_date') || undefined;
      const end_date = url.searchParams.get('end_date') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const limit = Number(url.searchParams.get('limit') || '200');
      const offset = Number(url.searchParams.get('offset') || '0');

      const result = await listTransactions(userId, { type, category_id, start_date, end_date, search, limit, offset });
      return Response.json(result);
    }

    // ── POST /api/transactions ─────────────────────────────────────────────────
    if (req.method === 'POST' && !txId) {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { category_id, type, amount, description, date } = body as Record<string, string | number>;

      if (!category_id || !type || amount === undefined || amount === null) {
        return Response.json({ error: 'category_id, type, and amount are required' }, { status: 400 });
      }
      if (type !== 'expense' && type !== 'credit') {
        return Response.json({ error: 'Type must be "expense" or "credit"' }, { status: 400 });
      }
      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return Response.json({ error: 'Amount must be a positive number' }, { status: 400 });
      }

      const tx = await createTransaction(userId, {
        category_id: String(category_id),
        type: type as 'expense' | 'credit',
        amount: numericAmount,
        description: description ? String(description) : '',
        date: date ? String(date) : undefined,
      });
      return Response.json({ transaction: tx }, { status: 201 });
    }

    // ── PUT /api/transactions/:id ─────────────────────────────────────────────
    if (req.method === 'PUT' && txId) {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const existing = await getTransactionById(userId, txId);
      if (!existing) return Response.json({ error: 'Transaction not found' }, { status: 404 });

      const { category_id, type, amount, description, date } = body as Record<string, string | number>;

      const newAmount = amount !== undefined ? Number(amount) : existing.amount;
      if (newAmount <= 0) return Response.json({ error: 'Amount must be greater than zero' }, { status: 400 });

      const updated = await updateTransaction(userId, txId, {
        category_id: category_id ? String(category_id) : undefined,
        type: type ? (type as 'expense' | 'credit') : undefined,
        amount: newAmount,
        description: description !== undefined ? String(description) : undefined,
        date: date ? String(date) : undefined,
      });

      if (!updated) return Response.json({ error: 'Transaction not found' }, { status: 404 });
      return Response.json({ transaction: updated });
    }

    // ── DELETE /api/transactions/:id ──────────────────────────────────────────
    if (req.method === 'DELETE' && txId) {
      const deleted = await deleteTransaction(userId, txId);
      if (!deleted) return Response.json({ error: 'Transaction not found' }, { status: 404 });
      return Response.json({ message: 'Transaction deleted successfully', id: txId });
    }

    return Response.json({ error: `Not found: ${req.method} ${url.pathname}` }, { status: 404 });
  } catch (err: any) {
    console.error('Transactions function error:', err);
    return Response.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
