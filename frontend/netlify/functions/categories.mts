/**
 * Netlify Function: Categories
 * Handles: GET  /api/categories
 *          POST /api/categories
 */
import type { Config } from '@netlify/functions';
import { getAuthUserId, unauthorizedResponse } from './_shared/auth.js';
import { listCategories, createCategory } from './_shared/db.js';

export const config: Config = {
  path: ['/api/categories', '/api/categories/*'],
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  const userId = getAuthUserId(req);
  if (!userId) return unauthorizedResponse();

  const url = new URL(req.url);

  try {
    // ── GET /api/categories ───────────────────────────────────────────────────
    if (req.method === 'GET') {
      const typeParam = url.searchParams.get('type');
      const typeFilter = typeParam === 'expense' || typeParam === 'credit' ? typeParam : undefined;
      const categories = await listCategories(userId, typeFilter);
      return Response.json({ categories });
    }

    // ── POST /api/categories ──────────────────────────────────────────────────
    if (req.method === 'POST') {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { name, type, color, icon } = body as Record<string, string>;

      if (!name || !type) {
        return Response.json({ error: 'Name and type (expense/credit) are required' }, { status: 400 });
      }
      if (type !== 'expense' && type !== 'credit') {
        return Response.json({ error: 'Type must be "expense" or "credit"' }, { status: 400 });
      }

      const category = await createCategory(userId, {
        name,
        type: type as 'expense' | 'credit',
        color: color || '#64748b',
        icon: icon || 'Tag',
      });

      return Response.json({ category }, { status: 201 });
    }

    return Response.json({ error: `Not found: ${req.method} ${url.pathname}` }, { status: 404 });
  } catch (err: any) {
    console.error('Categories function error:', err);
    return Response.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
