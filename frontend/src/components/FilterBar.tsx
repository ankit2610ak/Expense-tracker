import React from 'react';
import { Category } from '../types';
import { Filter, Search, Calendar, Tag } from 'lucide-react';

interface FilterBarProps {
  period: 'week' | 'month' | 'year' | 'all';
  onPeriodChange: (p: 'week' | 'month' | 'year' | 'all') => void;
  selectedCategory: string;
  onCategoryChange: (catId: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categories: Category[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  period,
  onPeriodChange,
  selectedCategory,
  onCategoryChange,
  selectedType,
  onTypeChange,
  searchQuery,
  onSearchChange,
  categories
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-4">
      {/* Top row: Period toggle & Type filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        {/* Period Selector: Week / Month / All */}
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Timeframe:
          </span>
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => onPeriodChange('week')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                period === 'week'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => onPeriodChange('month')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                period === 'month'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => onPeriodChange('year')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                period === 'year'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              12 Months
            </button>
            <button
              onClick={() => onPeriodChange('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                period === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Type Filter Buttons: All / Expenses / Credits */}
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Type:
          </span>
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => onTypeChange('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                selectedType === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onTypeChange('expense')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                selectedType === 'expense'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-rose-600'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => onTypeChange('credit')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                selectedType === 'credit'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-emerald-600'
              }`}
            >
              Credits
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Search & Category Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search transactions by note or merchant..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </div>

        {/* Category Filter Dropdown */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Tag className="w-4 h-4" />
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          >
            <option value="all">Filter by Category (All Categories)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

