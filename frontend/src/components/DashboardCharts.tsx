import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TimeSeriesPoint, CategorySummary } from '../types';
import { formatCurrency } from './BalanceCards';
import { BarChart3, PieChart as PieIcon } from 'lucide-react';

interface DashboardChartsProps {
  timeSeries: TimeSeriesPoint[];
  categoryBreakdown: CategorySummary[];
  currency: string;
  period: 'week' | 'month' | 'year' | 'all';
}

const DEFAULT_COLORS = ['#f97316', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#06b6d4', '#eab308', '#64748b'];

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  timeSeries,
  categoryBreakdown,
  currency,
  period
}) => {
  const periodTitle =
    period === 'week'
      ? 'Weekly Spending & Inflow'
      : period === 'month'
      ? 'Monthly Timeline'
      : period === 'year'
      ? '12-Month Spending & Inflow Trend'
      : 'Spending Trend';

  const hasTimelineData = timeSeries.some((t) => t.expenses > 0 || t.credits > 0);
  const hasCategoryData = categoryBreakdown.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Bar Chart: Expenses vs Credits */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              {periodTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparison between credits (inflows) and expenses (outflows)
            </p>
          </div>
        </div>

        {hasTimelineData ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const exp = payload.find((p) => p.dataKey === 'expenses')?.value as number || 0;
                      const cr = payload.find((p) => p.dataKey === 'credits')?.value as number || 0;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1">
                          <div className="font-bold border-b border-slate-700 pb-1 mb-1">{label}</div>
                          <div className="text-emerald-400">Credits: +{formatCurrency(cr, currency)}</div>
                          <div className="text-rose-400">Expenses: -{formatCurrency(exp, currency)}</div>
                          <div className="text-slate-300 font-semibold pt-1 border-t border-slate-800">
                            Net: {formatCurrency(cr - exp, currency)}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <Bar dataKey="credits" name="Credits" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <BarChart3 className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">No transactions recorded for this period</p>
            <p className="text-[11px] text-slate-400 mt-1">Add an expense or credit to see the bar chart preview</p>
          </div>
        )}
      </div>

      {/* 2. Donut Chart: Expense Category Breakdown */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-emerald-600" />
            Expense by Category
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Spending distribution
          </p>
        </div>

        {hasCategoryData ? (
          <div className="flex flex-col items-center my-auto">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={3}
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as CategorySummary;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs">
                            <div className="font-bold">{data.name}</div>
                            <div className="text-rose-400 mt-0.5">
                              {formatCurrency(data.total, currency)} ({data.percentage}%)
                            </div>
                            <div className="text-slate-400 text-[10px]">{data.count} transactions</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown pills */}
            <div className="w-full space-y-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
              {categoryBreakdown.slice(0, 5).map((cat, idx) => (
                <div key={cat.category_id || idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50">
                  <div className="flex items-center space-x-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length] }}
                    />
                    <span className="font-medium text-slate-700 truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="font-bold text-slate-900">{formatCurrency(cat.total, currency)}</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <PieIcon className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">No expenses in this period</p>
            <p className="text-[11px] text-slate-400 mt-1">Expenses will be categorized here</p>
          </div>
        )}
      </div>
    </div>
  );
};

