export interface DefaultCategory {
  name: string;
  type: 'expense' | 'credit';
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Expenses
  { name: 'Food & Dining',         type: 'expense', color: '#f97316', icon: 'Utensils' },
  { name: 'Groceries',             type: 'expense', color: '#84cc16', icon: 'ShoppingCart' },
  { name: 'Housing & Rent',        type: 'expense', color: '#06b6d4', icon: 'Home' },
  { name: 'Utilities & Bills',     type: 'expense', color: '#eab308', icon: 'Zap' },
  { name: 'Transportation',        type: 'expense', color: '#3b82f6', icon: 'Car' },
  { name: 'Entertainment',         type: 'expense', color: '#a855f7', icon: 'Film' },
  { name: 'Healthcare',            type: 'expense', color: '#ef4444', icon: 'HeartPulse' },
  { name: 'Shopping & Personal',   type: 'expense', color: '#ec4899', icon: 'ShoppingBag' },
  { name: 'Education',             type: 'expense', color: '#6366f1', icon: 'GraduationCap' },
  { name: 'Other Expense',         type: 'expense', color: '#64748b', icon: 'MoreHorizontal' },
  // Credits
  { name: 'Salary',                type: 'credit',  color: '#10b981', icon: 'Briefcase' },
  { name: 'Freelance & Contract',  type: 'credit',  color: '#14b8a6', icon: 'Laptop' },
  { name: 'Investments & Dividends', type: 'credit', color: '#8b5cf6', icon: 'TrendingUp' },
  { name: 'Refunds & Grants',      type: 'credit',  color: '#0ea5e9', icon: 'RotateCcw' },
  { name: 'Gifts & Bonuses',       type: 'credit',  color: '#f59e0b', icon: 'Gift' },
  { name: 'Other Credit',          type: 'credit',  color: '#475569', icon: 'DollarSign' },
];

