import { Router, Response } from 'express';
import { getDatabase } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import {
  BalanceSummary,
  TimeSeriesPoint,
  CategorySummary,
  DashboardResponse,
  Transaction
} from '../types/index.js';

const router = Router();

router.use(requireAuth);

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPeriodDates(period: 'week' | 'month' | 'year' | 'all', refDateStr?: string) {
  const ref = refDateStr ? new Date(refDateStr) : new Date();
  if (isNaN(ref.getTime())) {
    throw new Error('Invalid reference date');
  }

  if (period === 'all') {
    return { startDate: null, endDate: null };
  }

  if (period === 'week') {
    const day = ref.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      startDate: formatDate(monday),
      endDate: formatDate(sunday)
    };
  }

  if (period === 'month') {
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return {
      startDate: formatDate(firstDay),
      endDate: formatDate(lastDay)
    };
  }

  // period === 'year' (12-month rolling timeframe)
  const endYear = ref.getFullYear();
  const endMonth = ref.getMonth();
  const startDay = new Date(endYear, endMonth - 11, 1);
  const endDay = new Date(endYear, endMonth + 1, 0);

  return {
    startDate: formatDate(startDay),
    endDate: formatDate(endDay)
  };
}

router.get('/summary', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const period = (req.query.period as 'week' | 'month' | 'year' | 'all') || 'month';
  const refDate = (req.query.date as string) || formatDate(new Date());

  const db = getDatabase();

  const settings = db.prepare(`
    SELECT initial_opening_balance, currency
    FROM user_settings
    WHERE user_id = ?
  `).get(userId) as { initial_opening_balance: number; currency: string } | undefined;

  const initialBaseline = settings?.initial_opening_balance || 0;
  const currency = settings?.currency || 'INR';

  const { startDate, endDate } = getPeriodDates(period, refDate);

  // 1. Calculate Opening Balance
  let openingBalance = initialBaseline;
  if (startDate) {
    const priorTotals = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as prior_credits,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as prior_expenses
      FROM transactions
      WHERE user_id = ? AND date < ?
    `).get(userId, startDate) as { prior_credits: number; prior_expenses: number };

    openingBalance = initialBaseline + priorTotals.prior_credits - priorTotals.prior_expenses;
  }

  // 2. Calculate Period Credits & Expenses
  let periodQuery = `
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as period_credits,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as period_expenses
    FROM transactions
    WHERE user_id = ?
  `;
  const periodParams: unknown[] = [userId];

  if (startDate && endDate) {
    periodQuery += ' AND date >= ? AND date <= ?';
    periodParams.push(startDate, endDate);
  }

  const periodTotals = db.prepare(periodQuery).get(...periodParams) as {
    period_credits: number;
    period_expenses: number;
  };

  const closingBalance = openingBalance + periodTotals.period_credits - periodTotals.period_expenses;

  const summary: BalanceSummary = {
    opening_balance: Number(openingBalance.toFixed(2)),
    total_expenses: Number(periodTotals.period_expenses.toFixed(2)),
    total_credits: Number(periodTotals.period_credits.toFixed(2)),
    closing_balance: Number(closingBalance.toFixed(2)),
    currency,
    period,
    start_date: startDate || undefined,
    end_date: endDate || undefined
  };

  // 3. Time Series Breakdown (for chart)
  const timeSeries: TimeSeriesPoint[] = [];

  if (period === 'week' && startDate && endDate) {
    const start = new Date(startDate);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dStr = formatDate(d);

      const dayRow = db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as credits
        FROM transactions
        WHERE user_id = ? AND date = ?
      `).get(userId, dStr) as { expenses: number; credits: number };

      timeSeries.push({
        label: `${dayNames[i]} (${d.getDate()})`,
        date: dStr,
        expenses: Number(dayRow.expenses.toFixed(2)),
        credits: Number(dayRow.credits.toFixed(2)),
        net: Number((dayRow.credits - dayRow.expenses).toFixed(2))
      });
    }
  } else if (period === 'month' && startDate && endDate) {
    // Break down by week or individual active days in month
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysInMonth = end.getDate();

    // Grouping by 4/5 weeks or intervals
    const weeklyBuckets = [
      { label: 'Week 1 (1-7)', startDay: 1, endDay: 7 },
      { label: 'Week 2 (8-14)', startDay: 8, endDay: 14 },
      { label: 'Week 3 (15-21)', startDay: 15, endDay: 21 },
      { label: 'Week 4 (22-28)', startDay: 22, endDay: 28 },
      { label: `Week 5 (29-${daysInMonth})`, startDay: 29, endDay: daysInMonth }
    ];

    const yearMonth = startDate.slice(0, 8); // 'YYYY-MM-'

    for (const bucket of weeklyBuckets) {
      if (bucket.startDay > daysInMonth) continue;
      const bStart = `${yearMonth}${String(bucket.startDay).padStart(2, '0')}`;
      const bEnd = `${yearMonth}${String(Math.min(bucket.endDay, daysInMonth)).padStart(2, '0')}`;

      const bucketRow = db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as credits
        FROM transactions
        WHERE user_id = ? AND date >= ? AND date <= ?
      `).get(userId, bStart, bEnd) as { expenses: number; credits: number };

      timeSeries.push({
        label: bucket.label,
        date: bStart,
        expenses: Number(bucketRow.expenses.toFixed(2)),
        credits: Number(bucketRow.credits.toFixed(2)),
        net: Number((bucketRow.credits - bucketRow.expenses).toFixed(2))
      });
    }
  } else if (period === 'year' && startDate && endDate) {
    // 12 months chronological breakdown
    const ref = refDate ? new Date(refDate) : new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      const ym = formatDate(d).slice(0, 7); // YYYY-MM
      const mStart = `${ym}-01`;
      const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const mEnd = `${ym}-${String(lastDayOfMonth).padStart(2, '0')}`;
      const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });

      const mRow = db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as credits
        FROM transactions
        WHERE user_id = ? AND date >= ? AND date <= ?
      `).get(userId, mStart, mEnd) as { expenses: number; credits: number };

      timeSeries.push({
        label: monthName,
        date: mStart,
        expenses: Number(mRow.expenses.toFixed(2)),
        credits: Number(mRow.credits.toFixed(2)),
        net: Number((mRow.credits - mRow.expenses).toFixed(2))
      });
    }
  } else {
    // All time - show last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = formatDate(d).slice(0, 7); // YYYY-MM
      const mStart = `${ym}-01`;
      const mEnd = `${ym}-31`;
      const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });

      const mRow = db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as credits
        FROM transactions
        WHERE user_id = ? AND date >= ? AND date <= ?
      `).get(userId, mStart, mEnd) as { expenses: number; credits: number };

      timeSeries.push({
        label: monthName,
        date: mStart,
        expenses: Number(mRow.expenses.toFixed(2)),
        credits: Number(mRow.credits.toFixed(2)),
        net: Number((mRow.credits - mRow.expenses).toFixed(2))
      });
    }
  }

  // 4. Category Breakdown (Expenses)
  let catQuery = `
    SELECT 
      c.id as category_id,
      c.name,
      c.type,
      c.color,
      c.icon,
      SUM(t.amount) as total,
      COUNT(t.id) as count
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'expense'
  `;
  const catParams: unknown[] = [userId];

  if (startDate && endDate) {
    catQuery += ' AND t.date >= ? AND t.date <= ?';
    catParams.push(startDate, endDate);
  }

  catQuery += ' GROUP BY c.id ORDER BY total DESC';

  const rawCatBreakdown = db.prepare(catQuery).all(...catParams) as unknown as {
    category_id: string;
    name: string;
    type: 'expense';
    color: string;
    icon: string;
    total: number;
    count: number;
  }[];

  const totalExpenseVal = periodTotals.period_expenses;
  const categoryBreakdown: CategorySummary[] = rawCatBreakdown.map(cat => ({
    category_id: cat.category_id,
    name: cat.name,
    type: cat.type,
    color: cat.color,
    icon: cat.icon,
    total: Number(cat.total.toFixed(2)),
    percentage: totalExpenseVal > 0 ? Number(((cat.total / totalExpenseVal) * 100).toFixed(1)) : 0,
    count: cat.count
  }));

  // 5. Recent 5 Transactions
  const recentTransactions = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 6
  `).all(userId) as unknown as Transaction[];

  const response: DashboardResponse = {
    summary,
    timeSeries,
    categoryBreakdown,
    recentTransactions
  };

  res.json(response);
});

export default router;
