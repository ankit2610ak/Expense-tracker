import React, { useState } from 'react';
import { Transaction } from '../types';
import { formatCurrency } from './BalanceCards';
import { transactionsApi } from '../services/api';
import { Trash2, Calendar, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  totals: { total_expenses: number; total_credits: number; net: number; count: number };
  currency: string;
  onRefresh: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  totals,
  currency,
  onRefresh
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      setDeletingId(id);
      await transactionsApi.delete(id);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete transaction');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header with counts and totals */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Transaction History
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing {transactions.length} record{transactions.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Filtered Totals Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200/60 font-semibold text-rose-700 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
            Expenses: -{formatCurrency(totals.total_expenses, currency)}
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/60 font-semibold text-emerald-700 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
            Credits: +{formatCurrency(totals.total_credits, currency)}
          </div>
        </div>
      </div>

      {/* Transactions Table / List */}
      {transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {transactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    {/* Date */}
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-slate-600 font-medium">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDateLabel(tx.date)}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold shadow-xs"
                        style={{
                          backgroundColor: `${tx.category_color || '#64748b'}18`,
                          color: tx.category_color || '#475569',
                          borderColor: `${tx.category_color || '#64748b'}40`,
                          borderWidth: '1px'
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0"
                          style={{ backgroundColor: tx.category_color || '#64748b' }}
                        />
                        {tx.category_name || 'General'}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 text-slate-700 font-medium max-w-xs truncate">
                      {tx.description ? (
                        tx.description
                      ) : (
                        <span className="text-slate-400 italic">No notes</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right font-bold">
                      <span
                        className={
                          isExpense ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'
                        }
                      >
                        {isExpense ? '-' : '+'}
                        {formatCurrency(tx.amount, currency)}
                      </span>
                    </td>

                    {/* Delete action */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(tx.id)}
                        disabled={deletingId === tx.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Receipt className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-700">No transactions found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your filters, or use the form above to record your first expense or credit.
          </p>
        </div>
      )}
    </div>
  );
};

