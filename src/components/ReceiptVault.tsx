import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Eye, 
  ZoomIn, 
  Upload, 
  Receipt, 
  Calendar,
  Building,
  Tag
} from 'lucide-react';
import { ExpenseItem, ReceiptStatus } from '../types';
import { Translations } from '../i18n/translations';
import { formatCurrencyIdr, formatDate } from '../utils/formatters';

interface ReceiptVaultProps {
  expenses: ExpenseItem[];
  t: Translations;
  onOpenReceiptModal: (expense: ExpenseItem) => void;
  onOpenAddExpense: () => void;
}

export const ReceiptVault: React.FC<ReceiptVaultProps> = ({
  expenses,
  t,
  onOpenReceiptModal,
  onOpenAddExpense
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = expenses.filter(e => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'has_receipt') return !!e.receiptUrl;
    if (filterStatus === 'no_receipt') return !e.receiptUrl;
    return e.receiptStatus === filterStatus;
  });

  const verifiedCount = expenses.filter(e => e.receiptStatus === 'verified').length;
  const pendingCount = expenses.filter(e => e.receiptStatus === 'pending' || !e.receiptUrl).length;

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {t.nav.receipts}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
              Photographic proofs and receipts sent by husband Slamet from Indramayu. Siti reviews and verifies each transaction from Hong Kong.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddExpense}
              className="hidden items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload New Proof</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-fit">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            All Items ({expenses.length})
          </button>
          <button
            onClick={() => setFilterStatus('verified')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === 'verified'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            Verified ({verifiedCount})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === 'pending'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            Pending Proof ({pendingCount})
          </button>
        </div>
      </div>

      {/* Grid of Receipts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((item) => {
          const hasImage = !!item.receiptUrl;

          return (
            <div 
              key={item.id}
              className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between"
            >
              {/* Receipt Image / Placeholder */}
              <div 
                onClick={() => onOpenReceiptModal(item)}
                className="relative h-48 bg-neutral-100 dark:bg-neutral-800 cursor-pointer group overflow-hidden"
              >
                {hasImage ? (
                  <img
                    src={item.receiptUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 space-y-2 p-4 text-center">
                    <Receipt className="w-10 h-10 opacity-40" />
                    <span className="text-xs">No receipt photo attached yet</span>
                  </div>
                )}

                {/* Hover inspect overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-medium backdrop-blur-2xs">
                  <ZoomIn className="w-4 h-4" />
                  <span>Inspect Receipt</span>
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  {item.receiptStatus === 'verified' && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-600/90 text-white shadow-xs backdrop-blur-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified</span>
                    </span>
                  )}
                  {item.receiptStatus === 'pending' && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/90 text-white shadow-xs backdrop-blur-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Pending Photo</span>
                    </span>
                  )}
                  {item.receiptStatus === 'needs_clarification' && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-orange-600/90 text-white shadow-xs backdrop-blur-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Clarification</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Receipt Details Card Body */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(item.date)}</span>
                    </div>
                    <span className="capitalize">{t.categories[item.categoryId]}</span>
                  </div>

                  <h4 className="mt-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                    {item.title}
                  </h4>

                  <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    <Building className="w-3 h-3 shrink-0" />
                    <span className="truncate">{item.vendor}</span>
                  </div>

                  {item.verificationNotes && (
                    <div className="mt-2 text-[11px] p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 border border-neutral-100 dark:border-neutral-800">
                      "{item.verificationNotes}"
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Amount</span>
                    <div className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                      {formatCurrencyIdr(item.amountIdr)}
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenReceiptModal(item)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                  >
                    Review Proof
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
