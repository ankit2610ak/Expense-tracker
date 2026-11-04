import { Router, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { Transaction } from '../types/index.js';

const router = Router();

router.use(requireAuth);

// GET /api/transactions - filtered list
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { type, category_id, start_date, end_date, search, limit = 200, offset = 0 } = req.query;
  const db = getDatabase();

  let query = `
    SELECT t.id, t.user_id, t.category_id, t.type, t.amount, t.description, t.date,
           t.created_at, t.updated_at,
           c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (type && type !== 'all') {
    query += ' AND t.type = ?';
    params.push(type);
  }

  if (category_id && category_id !== 'all') {
    query += ' AND t.category_id = ?';
    params.push(category_id);
  }

  if (start_date) {
    query += ' AND t.date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    query += ' AND t.date <= ?';
    params.push(end_date);
  }

  if (search) {
    query += ' AND (t.description LIKE ? OR c.name LIKE ?)';
    const term = `%${String(search).trim()}%`;
    params.push(term, term);
  }

  query += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 200, Number(offset) || 0);

  const transactions = db.prepare(query).all(...params) as unknown as Transaction[];

  // Also get totals for currently filtered criteria (or period)
  let countQuery = `
    SELECT 
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
      COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) as total_credits,
      COUNT(t.id) as count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
  `;
  const countParams: unknown[] = [userId];

  if (type && type !== 'all') {
    countQuery += ' AND t.type = ?';
    countParams.push(type);
  }
  if (category_id && category_id !== 'all') {
    countQuery += ' AND t.category_id = ?';
    countParams.push(category_id);
  }
  if (start_date) {
    countQuery += ' AND t.date >= ?';
    countParams.push(start_date);
  }
  if (end_date) {
    countQuery += ' AND t.date <= ?';
    countParams.push(end_date);
  }
  if (search) {
    countQuery += ' AND (t.description LIKE ? OR c.name LIKE ?)';
    const term = `%${String(search).trim()}%`;
    countParams.push(term, term);
  }

  const totals = db.prepare(countQuery).get(...countParams) as {
    total_expenses: number;
    total_credits: number;
    count: number;
  };

  res.json({
    transactions,
    totals: {
      total_expenses: totals.total_expenses,
      total_credits: totals.total_credits,
      net: totals.total_credits - totals.total_expenses,
      count: totals.count
    }
  });
});

// POST /api/transactions - create transaction
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { category_id, type, amount, description = '', date } = req.body;

  if (!category_id || !type || amount === undefined || amount === null) {
    res.status(400).json({ error: 'category_id, type, and amount are required' });
    return;
  }

  if (type !== 'expense' && type !== 'credit') {
    res.status(400).json({ error: 'Type must be "expense" or "credit"' });
    return;
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    res.status(400).json({ error: 'Amount must be a positive number' });
    return;
  }

  const db = getDatabase();

  // Validate category exists
  const category = db.prepare(`
    SELECT id, name, color, icon FROM categories
    WHERE id = ? AND (user_id IS NULL OR user_id = ?)
  `).get(category_id, userId) as { id: string; name: string; color: string; icon: string } | undefined;

  if (!category) {
    res.status(400).json({ error: 'Invalid category selected' });
    return;
  }

  const txDate = date ? String(date).trim() : new Date().toISOString().slice(0, 10);
  const id = randomUUID();

  const insert = db.prepare(`
    INSERT INTO transactions (id, user_id, category_id, type, amount, description, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(id, userId, category_id, type, numericAmount, String(description).trim(), txDate);

  const newTx: Transaction = {
    id,
    user_id: userId,
    category_id,
    category_name: category.name,
    category_color: category.color,
    category_icon: category.icon,
    type,
    amount: numericAmount,
    description: String(description).trim(),
    date: txDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  res.status(201).json({ transaction: newTx });
});

// PUT /api/transactions/:id - update transaction
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const txId = req.params.id;
  const { category_id, type, amount, description, date } = req.body;
  const db = getDatabase();

  const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(txId, userId) as Transaction | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  const newCategory = category_id || existing.category_id;
  const newType = type || existing.type;
  const newAmount = amount !== undefined ? Number(amount) : existing.amount;
  const newDescription = description !== undefined ? String(description).trim() : existing.description;
  const newDate = date || existing.date;

  if (newAmount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than zero' });
    return;
  }

  db.prepare(`
    UPDATE transactions
    SET category_id = ?, type = ?, amount = ?, description = ?, date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(newCategory, newType, newAmount, newDescription, newDate, txId, userId);

  const updated = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(txId) as unknown as Transaction;

  res.json({ transaction: updated });
});

// DELETE /api/transactions/:id - delete transaction
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const txId = req.params.id;
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(txId, userId);
  if (!existing) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(txId, userId);
  res.json({ message: 'Transaction deleted successfully', id: txId });
});

export default router;

