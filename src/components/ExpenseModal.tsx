import React, { useState } from 'react';
import { X, Upload, Camera, Trash2 } from 'lucide-react';
import { CategoryId, ExpenseItem, ReceiptStatus } from '../types';
import { Translations } from '../i18n/translations';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: ExpenseItem) => void;
  editingExpense?: ExpenseItem | null;
  husbandName: string;
  t: Translations;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingExpense,
  husbandName,
  t
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState(editingExpense?.title || '');
  const [amountIdr, setAmountIdr] = useState(editingExpense?.amountIdr || 500000);
  const [categoryId, setCategoryId] = useState<CategoryId>(editingExpense?.categoryId || 'renovation');
  const [vendor, setVendor] = useState(editingExpense?.vendor || '');
  const [date, setDate] = useState(editingExpense?.date || new Date().toISOString().slice(0, 10));
  const [receiptUrl, setReceiptUrl] = useState<string>(editingExpense?.receiptUrl || '');
  const [receiptStatus, setReceiptStatus] = useState<ReceiptStatus>(editingExpense?.receiptStatus || 'verified');
  const [verificationNotes, setVerificationNotes] = useState(editingExpense?.verificationNotes || '');

  // Handle local file upload (converts to Base64 so it stores offline in localStorage)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReceiptUrl(event.target?.result as string);
        if (receiptStatus === 'no_receipt') {
          setReceiptStatus('pending');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUseSampleReceipt = () => {
    setReceiptUrl('/images/receipt_sample_material_1794285314395.jpg');
    setReceiptStatus('verified');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const item: ExpenseItem = {
      id: editingExpense?.id || `exp-${Date.now()}`,
      date,
      monthYear: date.slice(0, 7),
      categoryId,
      title,
      amountIdr: Number(amountIdr),
      vendor: vendor || 'Local Store',
      paidBy: editingExpense?.paidBy || husbandName,
      receiptUrl: receiptUrl || undefined,
      receiptStatus: receiptUrl ? receiptStatus : (receiptStatus === 'verified' ? 'pending' : receiptStatus),
      verificationNotes: verificationNotes || undefined,
      verifiedAt: receiptStatus === 'verified' ? new Date().toISOString().slice(0, 10) : undefined
    };

    onSave(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg my-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            {editingExpense ? t.actions.editExpense : t.actions.addExpense}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t.table.description}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 20 Bags of Cement & River Sand"
              className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t.table.amount}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono">Rp</span>
                <input
                  type="number"
                  required
                  step="5000"
                  min="0"
                  value={amountIdr}
                  onChange={(e) => setAmountIdr(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 font-mono rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t.table.date}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Category & Vendor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t.table.category}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value as CategoryId)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="renovation">{t.categories.renovation}</option>
                <option value="tuition">{t.categories.tuition}</option>
                <option value="allowance">{t.categories.allowance}</option>
                <option value="savings">{t.categories.savings}</option>
                <option value="miscellaneous">{t.categories.miscellaneous}</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t.table.vendor}
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Toko Bangunan Rejeki"
                className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Receipt / Photo Proof Attachment */}
          <div className="space-y-2">
            <label className="block font-medium text-neutral-700 dark:text-neutral-300">
              Receipt Proof (Husband's photo / receipt)
            </label>

            {receiptUrl ? (
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={receiptUrl}
                    alt="Receipt"
                    className="w-12 h-12 rounded-lg object-cover border border-neutral-200"
                  />
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      Receipt attached
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Stored offline in browser memory
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setReceiptUrl('')}
                  className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                  title="Remove image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer transition-colors">
                  <Camera className="w-6 h-6 text-neutral-400 mb-1" />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Click to select receipt photo
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    JPG, PNG (stored offline locally)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleUseSampleReceipt}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Attach Sample Indonesian Store Receipt
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Verification Status */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Audit Status
            </label>
            <select
              value={receiptStatus}
              onChange={(e) => setReceiptStatus(e.target.value as ReceiptStatus)}
              className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="verified">{t.receiptStatus.verified}</option>
              <option value="pending">{t.receiptStatus.pending}</option>
              <option value="needs_clarification">{t.receiptStatus.needs_clarification}</option>
              <option value="no_receipt">{t.receiptStatus.no_receipt}</option>
            </select>
          </div>

          {/* Verification Notes */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Verification Notes / Husband Remarks
            </label>
            <input
              type="text"
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              placeholder="e.g. Checked by Siti from Hong Kong via video call"
              className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 transition-colors"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs"
            >
              {t.actions.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
