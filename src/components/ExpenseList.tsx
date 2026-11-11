import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Receipt, 
  Plus, 
  ArrowUpDown, 
  X,
  FileCheck2,
  Calendar,
  Home,
  GraduationCap,
  ShoppingBag,
  PiggyBank
} from 'lucide-react';
import { CategoryId, ExpenseItem, ReceiptStatus } from '../types';
import { Translations } from '../i18n/translations';
import { formatCurrencyIdr, formatDate, formatMonthYear } from '../utils/formatters';

interface ExpenseListProps {
  expenses: ExpenseItem[];
  selectedMonth: string;
  onSelectMonth: (m: string) => void;
  availableMonths: string[];
  t: Translations;
  onAddExpense: () => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
  onOpenReceiptModal: (expense: ExpenseItem) => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  selectedMonth,
  onSelectMonth,
  availableMonths,
  t,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onOpenReceiptModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  // Filter and sort expenses
  const filtered = useMemo(() => {
    return expenses.filter(item => {
      // Month filter
      if (selectedMonth !== 'all' && item.monthYear !== selectedMonth) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'all' && item.receiptStatus !== selectedStatus) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesVendor = item.vendor.toLowerCase().includes(q);
        const matchesNotes = (item.verificationNotes || '').toLowerCase().includes(q);
        const matchesPaidBy = item.paidBy.toLowerCase().includes(q);
        if (!matchesTitle && !matchesVendor && !matchesNotes && !matchesPaidBy) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') return b.date.localeCompare(a.date);
      if (sortBy === 'date_asc') return a.date.localeCompare(b.date);
      if (sortBy === 'amount_desc') return b.amountIdr - a.amountIdr;
      if (sortBy === 'amount_asc') return a.amountIdr - b.amountIdr;
      return 0;
    });
  }, [expenses, selectedMonth, selectedCategory, selectedStatus, searchQuery, sortBy]);

  const totalFilteredAmount = filtered.reduce((acc, curr) => acc + curr.amountIdr, 0);

  const categoryIcons: Record<CategoryId, React.ReactNode> = {
    renovation: <Home className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
    tuition: <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
    allowance: <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
    savings: <PiggyBank className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
    miscellaneous: <Receipt className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
  };

  const statusBadge = (status: ReceiptStatus) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t.receiptStatus.verified}</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>{t.receiptStatus.pending}</span>
          </span>
        );
      case 'needs_clarification':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-orange-700 dark:text-orange-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{t.receiptStatus.needs_clarification}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{t.receiptStatus.no_receipt}</span>
          </span>
        );
    }
  };

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'all' || selectedStatus !== 'all' || selectedMonth !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    onSelectMonth('all');
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.filters.searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Filter */}
            <select
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="text-xs font-medium py-2 px-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">{t.filters.allMonths}</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthYear(m)}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-medium py-2 px-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">{t.filters.allCategories}</option>
              <option value="renovation">{t.categories.renovation}</option>
              <option value="tuition">{t.categories.tuition}</option>
              <option value="allowance">{t.categories.allowance}</option>
              <option value="savings">{t.categories.savings}</option>
              <option value="miscellaneous">{t.categories.miscellaneous}</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-medium py-2 px-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">{t.filters.allStatuses}</option>
              <option value="verified">{t.receiptStatus.verified}</option>
              <option value="pending">{t.receiptStatus.pending}</option>
              <option value="needs_clarification">{t.receiptStatus.needs_clarification}</option>
            </select>

            {/* Sort Order */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="text-xs font-medium py-2 px-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="date_desc">Date (Newest)</option>
              <option value="date_asc">Date (Oldest)</option>
              <option value="amount_desc">Amount (Highest)</option>
              <option value="amount_asc">Amount (Lowest)</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-2.5 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
              >
                {t.actions.clearFilter}
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary Strip */}
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>Showing <strong className="text-neutral-900 dark:text-neutral-100 font-mono">{filtered.length}</strong> expenses</span>
          <span>Filtered Total: <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">{formatCurrencyIdr(totalFilteredAmount)}</strong></span>
        </div>
      </div>

      {/* Main Expense Table */}
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Receipt className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto" />
            <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {t.table.noData}
            </div>
            <button
              onClick={onAddExpense}
              className="hidden items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.actions.addExpense}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/75 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 font-medium">
                  <th className="py-3 px-4 whitespace-nowrap">{t.table.date}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.table.category}</th>
                  <th className="py-3 px-4 min-w-[200px]">{t.table.description}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.table.vendor}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{t.table.amount}</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">{t.table.receipt}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.table.status}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{t.table.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {filtered.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors"
                  >
                    {/* Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-neutral-600 dark:text-neutral-400">
                      {formatDate(item.date)}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
                        {categoryIcons[item.categoryId]}
                        <span>{t.categories[item.categoryId]}</span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 font-medium text-neutral-900 dark:text-neutral-100">
                      <div>{item.title}</div>
                      {item.verificationNotes && (
                        <div className="text-[11px] text-neutral-400 dark:text-neutral-500 font-normal mt-0.5 line-clamp-1">
                          {item.verificationNotes}
                        </div>
                      )}
                    </td>

                    {/* Vendor */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                      {item.vendor}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatCurrencyIdr(item.amountIdr)}
                    </td>

                    {/* Receipt Preview Thumbnail */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {item.receiptUrl ? (
                        <button
                          onClick={() => onOpenReceiptModal(item)}
                          className="inline-block w-8 h-8 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer"
                          title="Click to zoom & verify receipt"
                        >
                          <img 
                            src={item.receiptUrl} 
                            alt="receipt" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                          No file
                        </span>
                      )}
                    </td>

                    {/* Audit Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {statusBadge(item.receiptStatus)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditExpense(item)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          title={t.actions.editExpense}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteExpense(item.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title={t.actions.deleteExpense}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
