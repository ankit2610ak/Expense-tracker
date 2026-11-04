import React, { useState } from 'react';
import { Category, TransactionType } from '../types';
import { transactionsApi, categoriesApi } from '../services/api';
import { getCurrencySymbol } from './BalanceCards';
import { PlusCircle, Tag, Calendar, FileText, Plus } from 'lucide-react';

interface TransactionFormProps {
  categories: Category[];
  currency: string;
  onSuccess: () => void;
  onCategoryCreated: (newCat: Category) => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  categories,
  currency,
  onSuccess,
  onCategoryCreated
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Category inline state
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');

  // Filter categories by selected transaction type
  const availableCategories = categories.filter((c) => c.type === type);

  // Set default category whenever type changes or categories update
  React.useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.find((c) => c.id === categoryId)) {
      setCategoryId(availableCategories[0].id);
    }
  }, [type, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    try {
      setIsSubmitting(true);
      await transactionsApi.create({
        type,
        amount: numAmount,
        category_id: categoryId,
        date,
        description: description.trim()
      });

      // Reset form fields
      setAmount('');
      setDescription('');
      onSuccess();
    } catch (err: any) {
      console.error('Error creating transaction:', err);
      setError(err.response?.data?.error || 'Failed to record transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const created = await categoriesApi.create({
        name: newCatName.trim(),
        type,
        color: newCatColor
      });
      onCategoryCreated(created);
      setCategoryId(created.id);
      setNewCatName('');
      setShowAddCat(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create category');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-emerald-600" />
          Quick Add Transaction
        </h3>

        {/* Type toggle buttons */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              type === 'expense'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('credit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              type === 'credit'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Credit / Income
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Amount Field */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Amount ({currency})
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold text-sm">
                {getCurrencySymbol(currency)}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Date Field */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Date
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Category Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Category
            </label>
            <button
              type="button"
              onClick={() => setShowAddCat(!showAddCat)}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              New Category
            </button>
          </div>

          {showAddCat ? (
            <div className="p-3 bg-slate-50 border border-emerald-200 rounded-xl mb-3 space-y-2">
              <div className="text-xs font-bold text-slate-700">Add Custom {type} Category:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Category Name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="w-9 h-8 p-0.5 border border-slate-200 rounded-lg cursor-pointer bg-white"
                  title="Category Color"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCat(false)}
                  className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Tag className="w-4 h-4" />
            </span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            >
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description / Note Field */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Description / Note (Optional)
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <FileText className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Grocery store, Uber ride, Client invoice"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white shadow-md transition-all flex items-center justify-center gap-2 ${
            type === 'expense'
              ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
          } ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isSubmitting ? 'Recording...' : `Record ${type === 'expense' ? 'Expense' : 'Credit'}`}
        </button>
      </form>
    </div>
  );
};
