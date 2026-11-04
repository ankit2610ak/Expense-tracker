import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { BalanceCards } from './components/BalanceCards';
import { TransactionForm } from './components/TransactionForm';
import { FilterBar } from './components/FilterBar';
import { DashboardCharts } from './components/DashboardCharts';
import { TransactionList } from './components/TransactionList';
import { SettingsModal } from './components/SettingsModal';
import { Category, Transaction, DashboardResponse } from './types';
import { categoriesApi, transactionsApi, dashboardApi } from './services/api';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();

  // App State
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totals, setTotals] = useState({ total_expenses: 0, total_credits: 0, net: 0, count: 0 });
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);

  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      const cats = await categoriesApi.getAll();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  // Fetch Dashboard Summary (Opening/Closing balances, Weekly/Monthly charts)
  const fetchDashboard = useCallback(async () => {
    try {
      const data = await dashboardApi.getSummary({ period });
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }, [period]);

  // Fetch Filtered Transactions
  const fetchTransactions = useCallback(async () => {
    try {
      setIsDataLoading(true);

      // Determine date filters if period is week or month
      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;

      if (dashboardData?.summary) {
        startDate = dashboardData.summary.start_date;
        endDate = dashboardData.summary.end_date;
      }

      const res = await transactionsApi.getAll({
        type: selectedType !== 'all' ? selectedType : undefined,
        category_id: selectedCategory !== 'all' ? selectedCategory : undefined,
        start_date: period !== 'all' ? startDate : undefined,
        end_date: period !== 'all' ? endDate : undefined,
        search: searchQuery.trim() || undefined
      });

      setTransactions(res.transactions);
      setTotals(res.totals);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsDataLoading(false);
    }
  }, [selectedType, selectedCategory, period, dashboardData?.summary, searchQuery]);

  // Initial load when user signs in
  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchDashboard();
    }
  }, [user, fetchCategories, fetchDashboard]);

  // Reload transactions when filters or dashboard period changes
  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user, fetchTransactions]);

  const handleRefreshAll = () => {
    fetchDashboard();
    fetchTransactions();
  };

  const handleCategoryCreated = (newCat: Category) => {
    setCategories((prev) => [...prev, newCat]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading your financial workspace...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Welcome greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back, <span className="text-emerald-700">{user.name}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Here is your financial balance overview and spending breakdown.
            </p>
          </div>
        </div>

        {/* 1. Opening & Closing Balance Metric Cards */}
        <BalanceCards summary={dashboardData?.summary || null} currency={user.currency || 'USD'} />

        {/* 2. Charts & Analytics Overview */}
        <DashboardCharts
          timeSeries={dashboardData?.timeSeries || []}
          categoryBreakdown={dashboardData?.categoryBreakdown || []}
          currency={user.currency || 'USD'}
          period={period}
        />

        {/* 3. Transaction Entry Form & Filter Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Quick Add Form on the Left */}
          <div className="lg:col-span-1 sticky top-24">
            <TransactionForm
              categories={categories}
              currency={user.currency || 'USD'}
              onSuccess={handleRefreshAll}
              onCategoryCreated={handleCategoryCreated}
            />
          </div>

          {/* Filters & Transaction Table on the Right */}
          <div className="lg:col-span-2 space-y-5">
            <FilterBar
              period={period}
              onPeriodChange={(p) => setPeriod(p)}
              selectedCategory={selectedCategory}
              onCategoryChange={(c) => setSelectedCategory(c)}
              selectedType={selectedType}
              onTypeChange={(t) => setSelectedType(t)}
              searchQuery={searchQuery}
              onSearchChange={(q) => setSearchQuery(q)}
              categories={categories}
            />

            <TransactionList
              transactions={transactions}
              totals={totals}
              currency={user.currency || 'USD'}
              onRefresh={handleRefreshAll}
            />
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={handleRefreshAll}
      />
    </div>
  );
};

export default App;

