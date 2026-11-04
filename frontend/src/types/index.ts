export type TransactionType = 'expense' | 'credit';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  created_at: string;
  initial_opening_balance: number;
  currency: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface BalanceSummary {
  opening_balance: number;
  total_expenses: number;
  total_credits: number;
  closing_balance: number;
  currency: string;
  period: 'week' | 'month' | 'year' | 'all';
  start_date?: string;
  end_date?: string;
}

export interface TimeSeriesPoint {
  label: string;
  date: string;
  expenses: number;
  credits: number;
  net: number;
}

export interface CategorySummary {
  category_id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  total: number;
  percentage: number;
  count: number;
}

export interface DashboardResponse {
  summary: BalanceSummary;
  timeSeries: TimeSeriesPoint[];
  categoryBreakdown: CategorySummary[];
  recentTransactions: Transaction[];
}

