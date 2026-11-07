/**
 * Netlify Function: Dashboard
 * Handles: GET /api/dashboard/summary?period=week|month|year|all&date=YYYY-MM-DD
 */
import type { Config } from '@netlify/functions';
import { getAuthUserId, unauthorizedResponse } from './_shared/auth.js';
import { getSettings, getAllTransactionsForUser } from './_shared/db.js';

export const config: Config = {
  path: ['/api/dashboard/summary', '/api/dashboard/*'],
};

type Period = 'week' | 'month' | 'year' | 'all';

interface TimeSeriesPoint {
  label: string;
  date: string;
  expenses: number;
  credits: number;
  net: number;
}

interface CategorySummary {
  category_id: string;
  name: string;
  type: 'expense' | 'credit';
  color: string;
  icon: string;
  total: number;
  percentage: number;
  count: number;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPeriodDates(period: Period, refDateStr?: string): { startDate: string | null; endDate: string | null } {
  const ref = refDateStr ? new Date(refDateStr) : new Date();
  if (isNaN(ref.getTime())) throw new Error('Invalid reference date');

  if (period === 'all') return { startDate: null, endDate: null };

  if (period === 'week') {
    const day = ref.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { startDate: formatDate(monday), endDate: formatDate(sunday) };
  }

  if (period === 'month') {
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { startDate: formatDate(firstDay), endDate: formatDate(lastDay) };
  }

  // year = 12-month rolling
  const endYear = ref.getFullYear();
  const endMonth = ref.getMonth();
  const startDay = new Date(endYear, endMonth - 11, 1);
  const endDay = new Date(endYear, endMonth + 1, 0);
  return { startDate: formatDate(startDay), endDate: formatDate(endDay) };
}

function round2(n: number) { return Number(n.toFixed(2)); }

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  const userId = getAuthUserId(req);
  if (!userId) return unauthorizedResponse();

  if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const url = new URL(req.url);
    const period = (url.searchParams.get('period') || 'month') as Period;
    const refDate = url.searchParams.get('date') || formatDate(new Date());

    const settings = await getSettings(userId);
    const initialBaseline = settings.initial_opening_balance || 0;
    const currency = settings.currency || 'INR';

    const { startDate, endDate } = getPeriodDates(period, refDate);
    const allTxs = await getAllTransactionsForUser(userId);

    // 1. Opening Balance = initial + all prior transactions before startDate
    let openingBalance = initialBaseline;
    if (startDate) {
      const priorTxs = allTxs.filter(t => t.date < startDate);
      const priorCredits = priorTxs.reduce((s, t) => t.type === 'credit' ? s + t.amount : s, 0);
      const priorExpenses = priorTxs.reduce((s, t) => t.type === 'expense' ? s + t.amount : s, 0);
      openingBalance = initialBaseline + priorCredits - priorExpenses;
    }

    // 2. Period totals
    const periodTxs = allTxs.filter(t => {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });

    const period_credits  = periodTxs.reduce((s, t) => t.type === 'credit'  ? s + t.amount : s, 0);
    const period_expenses = periodTxs.reduce((s, t) => t.type === 'expense' ? s + t.amount : s, 0);
    const closingBalance = openingBalance + period_credits - period_expenses;

    const summary = {
      opening_balance:  round2(openingBalance),
      total_expenses:   round2(period_expenses),
      total_credits:    round2(period_credits),
      closing_balance:  round2(closingBalance),
      currency,
      period,
      start_date: startDate || undefined,
      end_date:   endDate   || undefined,
    };

    // 3. Time Series
    const timeSeries: TimeSeriesPoint[] = [];
    const ref = new Date(refDate);

    if (period === 'week' && startDate && endDate) {
      const start = new Date(startDate);
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dStr = formatDate(d);
        const dayTxs = allTxs.filter(t => t.date === dStr);
        const expenses = dayTxs.reduce((s, t) => t.type === 'expense' ? s + t.amount : s, 0);
        const credits  = dayTxs.reduce((s, t) => t.type === 'credit'  ? s + t.amount : s, 0);
        timeSeries.push({
          label: `${dayNames[i]} (${d.getDate()})`,
          date: dStr,
          expenses: round2(expenses),
          credits: round2(credits),
          net: round2(credits - expenses),
        });
      }
    } else if (period === 'month' && startDate && endDate) {
      const yearMonth = startDate.slice(0, 8);
      const daysInMonth = new Date(endDate).getDate();
      const buckets = [
        { label: 'Week 1 (1-7)',   startDay: 1,  endDay: 7 },
        { label: 'Week 2 (8-14)',  startDay: 8,  endDay: 14 },
        { label: 'Week 3 (15-21)', startDay: 15, endDay: 21 },
        { label: 'Week 4 (22-28)', startDay: 22, endDay: 28 },
        { label: `Week 5 (29-${daysInMonth})`, startDay: 29, endDay: daysInMonth },
      ];
      for (const b of buckets) {
        if (b.startDay > daysInMonth) continue;
        const bStart = `${yearMonth}${String(b.startDay).padStart(2, '0')}`;
        const bEnd   = `${yearMonth}${String(Math.min(b.endDay, daysInMonth)).padStart(2, '0')}`;
        const bTxs = allTxs.filter(t => t.date >= bStart && t.date <= bEnd);
        const expenses = bTxs.reduce((s, t) => t.type === 'expense' ? s + t.amount : s, 0);
        const credits  = bTxs.reduce((s, t) => t.type === 'credit'  ? s + t.amount : s, 0);
        timeSeries.push({
          label: b.label,
          date: bStart,
          expenses: round2(expenses),
          credits: round2(credits),
          net: round2(credits - expenses),
        });
      }
    } else if (period === 'year' && startDate && endDate) {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
        const ym = formatDate(d).slice(0, 7);
        const mStart = `${ym}-01`;
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const mEnd = `${ym}-${String(lastDay).padStart(2, '0')}`;
        const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const mTxs = allTxs.filter(t => t.date >= mStart && t.date <= mEnd);
        const expenses = mTxs.reduce((s, t) => t.type === 'expense' ? s + t.amount : s, 0);
        const credits  = mTxs.reduce((s, t) => t.type === 'credit'  ? s + t.amount : s, 0);
        timeSeries.push({
          label: monthName,
          date: mStart,
          expenses: round2(expenses),
          credits: round2(credits),
          net: round2(credits - expenses),
        });
      }
    } else {
      // All time: last 6 months
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = formatDate(d).slice(0, 7);
        const mStart = `${ym}-01`;
        const mEnd = `${ym}-31`;
        const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const mTxs = allTxs.filter(t => t.date >= mStart && t.date <= mEnd);
        const expenses = mTxs.reduce((s, t) => t.type === 'expense' ? s + t.amount : s, 0);
        const credits  = mTxs.reduce((s, t) => t.type === 'credit'  ? s + t.amount : s, 0);
        timeSeries.push({
          label: monthName,
          date: mStart,
          expenses: round2(expenses),
          credits: round2(credits),
          net: round2(credits - expenses),
        });
      }
    }

    // 4. Category breakdown (expenses only, filtered to period)
    const totalExpenseVal = period_expenses;
    const catMap = new Map<string, { name: string; color: string; icon: string; type: 'expense' | 'credit'; total: number; count: number }>();
    for (const t of periodTxs) {
      if (t.type !== 'expense') continue;
      const existing = catMap.get(t.category_id);
      if (existing) {
        existing.total += t.amount;
        existing.count += 1;
      } else {
        catMap.set(t.category_id, {
          name: t.category_name,
          color: t.category_color,
          icon: t.category_icon,
          type: 'expense',
          total: t.amount,
          count: 1,
        });
      }
    }

    const categoryBreakdown: CategorySummary[] = Array.from(catMap.entries())
      .map(([category_id, v]) => ({
        category_id,
        name: v.name,
        type: v.type,
        color: v.color,
        icon: v.icon,
        total: round2(v.total),
        percentage: totalExpenseVal > 0 ? Number(((v.total / totalExpenseVal) * 100).toFixed(1)) : 0,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total);

    // 5. Recent 6 transactions
    const sorted = [...allTxs].sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
    });
    const recentTransactions = sorted.slice(0, 6);

    return Response.json({ summary, timeSeries, categoryBreakdown, recentTransactions });
  } catch (err: any) {
    console.error('Dashboard function error:', err);
    return Response.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
