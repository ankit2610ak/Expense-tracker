import React from 'react';
import { BalanceSummary } from '../types';
import { ArrowUpRight, ArrowDownRight, Wallet, Scale } from 'lucide-react';

interface BalanceCardsProps {
  summary: BalanceSummary | null;
  currency: string;
  defaultOpeningBalance?: number;
}

export function getCurrencySymbol(currency: string = 'INR'): string {
  switch (currency.toUpperCase()) {
    case 'INR':
      return '₹';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'JPY':
      return '¥';
    case 'CAD':
      return 'CA$';
    case 'AUD':
      return 'A$';
    case 'CHF':
      return 'CHF';
    default:
      return currency;
  }
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  try {
    const locale = currency.toUpperCase() === 'INR' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (e) {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toFixed(2)}`;
  }
}

export const BalanceCards: React.FC<BalanceCardsProps> = ({ summary, currency, defaultOpeningBalance = 0 }) => {
  const opening = summary?.opening_balance ?? defaultOpeningBalance;
  const credits = summary?.total_credits ?? 0;
  const expenses = summary?.total_expenses ?? 0;
  const closing = summary?.closing_balance ?? (defaultOpeningBalance + credits - expenses);
  const periodLabel =
    summary?.period === 'week'
      ? 'This Week'
      : summary?.period === 'month'
      ? 'This Month'
      : summary?.period === 'year'
      ? 'Past 12 Months'
      : 'All Time';

  const isNetPositive = closing >= opening;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Opening Balance */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Opening Balance
          </span>
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {formatCurrency(opening, currency)}
          </div>
          <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
            Rollover at start of {periodLabel}
          </p>
        </div>
      </div>

      {/* 2. Total Credits */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            Total Credits / Income
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-emerald-600">
            +{formatCurrency(credits, currency)}
          </div>
          <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            Inflows during {periodLabel}
          </p>
        </div>
      </div>

      {/* 3. Total Expenses */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
            Total Expenses
          </span>
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-rose-600">
            -{formatCurrency(expenses, currency)}
          </div>
          <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
            Outflows during {periodLabel}
          </p>
        </div>
      </div>

      {/* 4. Closing Balance */}
      <div className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${
        isNetPositive 
          ? 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border-emerald-200/80' 
          : 'bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-white border-rose-200/80'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Closing Balance
          </span>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isNetPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            <Scale className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className={`text-2xl font-extrabold tracking-tight ${
            isNetPositive ? 'text-slate-900' : 'text-rose-700'
          }`}>
            {formatCurrency(closing, currency)}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-600">
            Opening ({formatCurrency(opening, currency)}) {credits >= 0 ? '+' : ''} {formatCurrency(credits - expenses, currency)}
          </p>
        </div>
      </div>
    </div>
  );
};
