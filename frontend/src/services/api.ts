import axios from 'axios';
import {
  UserProfile,
  Transaction,
  Category,
  DashboardResponse,
  TransactionType
} from '../types';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('expense_tracker_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Do not clear token if failing login attempt itself
      if (!error.config.url.includes('/auth/login') && !error.config.url.includes('/auth/register')) {
        localStorage.removeItem('expense_tracker_token');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: async (data: { name: string; email: string; password: string; initial_opening_balance?: number; currency?: string }) => {
    const res = await api.post<{ token: string; user: UserProfile }>('/auth/register', data);
    return res.data;
  },
  login: async (data: { email: string; password: string }) => {
    const res = await api.post<{ token: string; user: UserProfile }>('/auth/login', data);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get<{ user: UserProfile }>('/auth/me');
    return res.data.user;
  },
  updateSettings: async (data: { initial_opening_balance?: number; currency?: string }) => {
    const res = await api.put('/auth/settings', data);
    return res.data;
  }
};

export const transactionsApi = {
  getAll: async (params?: {
    type?: string;
    category_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => {
    const res = await api.get<{
      transactions: Transaction[];
      totals: { total_expenses: number; total_credits: number; net: number; count: number };
    }>('/transactions', { params });
    return res.data;
  },
  create: async (data: {
    category_id: string;
    type: TransactionType;
    amount: number;
    description?: string;
    date?: string;
  }) => {
    const res = await api.post<{ transaction: Transaction }>('/transactions', data);
    return res.data.transaction;
  },
  update: async (
    id: string,
    data: Partial<{
      category_id: string;
      type: TransactionType;
      amount: number;
      description: string;
      date: string;
    }>
  ) => {
    const res = await api.put<{ transaction: Transaction }>(`/transactions/${id}`, data);
    return res.data.transaction;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/transactions/${id}`);
    return res.data;
  }
};

export const categoriesApi = {
  getAll: async (type?: TransactionType) => {
    const res = await api.get<{ categories: Category[] }>('/categories', {
      params: type ? { type } : undefined
    });
    return res.data.categories;
  },
  create: async (data: { name: string; type: TransactionType; color?: string; icon?: string }) => {
    const res = await api.post<{ category: Category }>('/categories', data);
    return res.data.category;
  }
};

export const dashboardApi = {
  getSummary: async (params?: { period?: 'week' | 'month' | 'year' | 'all'; date?: string }) => {
    const res = await api.get<DashboardResponse>('/dashboard/summary', { params });
    return res.data;
  }
};

export default api;

