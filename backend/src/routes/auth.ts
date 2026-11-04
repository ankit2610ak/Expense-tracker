import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/database.js';
import { generateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { User, UserProfile } from '../types/index.js';

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, name, initial_opening_balance = 0, currency = 'INR' } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'User with this email already exists' });
    return;
  }

  const saltRounds = 10;
  const passwordHash = bcrypt.hashSync(password, saltRounds);
  const userId = randomUUID();

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, name)
    VALUES (?, ?, ?, ?)
  `);
  insertUser.run(userId, normalizedEmail, passwordHash, name.trim());

  const initialBalance = Number(initial_opening_balance) || 0;
  const insertSettings = db.prepare(`
    INSERT INTO user_settings (user_id, initial_opening_balance, currency)
    VALUES (?, ?, ?)
  `);
  insertSettings.run(userId, initialBalance, currency.trim().toUpperCase());

  const token = generateToken({ userId, email: normalizedEmail });

  const userProfile: UserProfile = {
    id: userId,
    email: normalizedEmail,
    name: name.trim(),
    created_at: new Date().toISOString(),
    initial_opening_balance: initialBalance,
    currency: currency.trim().toUpperCase()
  };

  res.status(201).json({
    token,
    user: userProfile
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = getDatabase();

  const user = db.prepare(`
    SELECT u.id, u.email, u.password_hash, u.name, u.created_at,
           COALESCE(s.initial_opening_balance, 0) as initial_opening_balance,
           COALESCE(s.currency, 'INR') as currency
    FROM users u
    LEFT JOIN user_settings s ON u.id = s.user_id
    WHERE u.email = ?
  `).get(normalizedEmail) as (User & { initial_opening_balance: number; currency: string }) | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = generateToken({ userId: user.id, email: user.email });

  const userProfile: UserProfile = {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.created_at,
    initial_opening_balance: user.initial_opening_balance,
    currency: user.currency
  };

  res.json({
    token,
    user: userProfile
  });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const db = getDatabase();

  const user = db.prepare(`
    SELECT u.id, u.email, u.name, u.created_at,
           COALESCE(s.initial_opening_balance, 0) as initial_opening_balance,
           COALESCE(s.currency, 'INR') as currency
    FROM users u
    LEFT JOIN user_settings s ON u.id = s.user_id
    WHERE u.id = ?
  `).get(userId) as UserProfile | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
});

router.put('/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { initial_opening_balance, currency } = req.body;
  const db = getDatabase();

  const current = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);

  const initialBalance = initial_opening_balance !== undefined ? Number(initial_opening_balance) : 0;
  const curr = currency ? String(currency).trim().toUpperCase() : 'INR';

  if (current) {
    db.prepare(`
      UPDATE user_settings
      SET initial_opening_balance = ?, currency = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(initialBalance, curr, userId);
  } else {
    db.prepare(`
      INSERT INTO user_settings (user_id, initial_opening_balance, currency)
      VALUES (?, ?, ?)
    `).run(userId, initialBalance, curr);
  }

  res.json({
    message: 'Settings updated successfully',
    settings: {
      user_id: userId,
      initial_opening_balance: initialBalance,
      currency: curr
    }
  });
});

export default router;
