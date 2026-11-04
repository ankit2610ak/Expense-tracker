import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Wallet, LogOut, Settings, User } from 'lucide-react';
import { getCurrencySymbol } from './BalanceCards';

interface NavbarProps {
  onOpenSettings: () => void;
}

const QUICK_CURRENCIES = [
  { code: 'INR', label: 'INR (₹)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'CAD', label: 'CAD (CA$)' },
  { code: 'AUD', label: 'AUD (A$)' },
  { code: 'JPY', label: 'JPY (¥)' }
];

export const Navbar: React.FC<NavbarProps> = ({ onOpenSettings }) => {
  const { user, logout, updateSettings } = useAuth();

  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value;
    try {
      await updateSettings(user?.initial_opening_balance, newCurrency);
    } catch (err) {
      console.error('Failed to update currency:', err);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Expense<span className="text-emerald-600">Track</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Pro
              </span>
            </div>
          </div>

          {/* User profile, Currency switcher, & actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Quick Currency Selector */}
            <div className="relative inline-flex items-center">
              <span className="absolute left-2.5 text-xs font-bold text-emerald-600 pointer-events-none">
                {getCurrencySymbol(user?.currency || 'INR')}
              </span>
              <select
                value={user?.currency || 'INR'}
                onChange={handleCurrencyChange}
                className="pl-6 pr-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                title="Change Currency Unit"
              >
                {QUICK_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-800 leading-tight">
                  {user?.name}
                </div>
                <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                  {user?.email}
                </div>
              </div>
            </div>

            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              title="Preferences & Initial Balance"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              onClick={logout}
              className="flex items-center space-x-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors border border-rose-200/60"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
