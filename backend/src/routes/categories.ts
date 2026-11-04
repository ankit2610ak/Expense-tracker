import { Router, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { Category } from '../types/index.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { type } = req.query;
  const db = getDatabase();

  let query = `
    SELECT id, user_id, name, type, color, icon
    FROM categories
    WHERE (user_id IS NULL OR user_id = ?)
  `;
  const params: unknown[] = [userId];

  if (type === 'expense' || type === 'credit') {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY CASE WHEN user_id IS NULL THEN 0 ELSE 1 END, name ASC';

  const categories = db.prepare(query).all(...params) as unknown as Category[];
  res.json({ categories });
});

router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { name, type, color = '#64748b', icon = 'Tag' } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'Name and type (expense/credit) are required' });
    return;
  }

  if (type !== 'expense' && type !== 'credit') {
    res.status(400).json({ error: 'Type must be "expense" or "credit"' });
    return;
  }

  const db = getDatabase();
  const id = randomUUID();

  const insert = db.prepare(`
    INSERT INTO categories (id, user_id, name, type, color, icon)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insert.run(id, userId, String(name).trim(), type, color, icon);

  const category: Category = {
    id,
    user_id: userId,
    name: String(name).trim(),
    type,
    color,
    icon
  };

  res.status(201).json({ category });
});

export default router;

