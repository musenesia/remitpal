import React, { useState, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, Upload, Camera, Trash2, ZoomIn } from 'lucide-react';
import { ExpenseItem, ReceiptStatus, UserProfile } from '../types';
import { Translations } from '../i18n/translations';
import { formatCurrencyIdr, formatDate } from '../utils/formatters';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: ExpenseItem | null;
  currentUser: UserProfile | null;
  onUpdateStatus: (id: string, status: ReceiptStatus, note: string) => void;
  onUploadReceipt: (id: string, receiptUrl: string) => void;
  t: Translations;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  expense,
  currentUser,
  onUpdateStatus,
  onUploadReceipt,
  t
}) => {
  const [status, setStatus] = useState<ReceiptStatus>(expense?.receiptStatus ?? 'pending');
  const [note, setNote] = useState<string>(expense?.verificationNotes || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sync local state when expense changes (modal reused across items)
  React.useEffect(() => {
    if (expense) {
      setStatus(expense.receiptStatus);
      setNote(expense.verificationNotes || '');
      setPreviewUrl(null);
    }
  }, [expense?.id]);

  if (!isOpen || !expense) return null;

  const isSlamet = currentUser?.role === 'manager';
  const isSiti = currentUser?.role === 'remitter';

  // The photo to display: newly selected preview takes priority over stored URL
  const displayPhoto = previewUrl ?? expense.receiptUrl ?? null;
  const hasPhoto = !!displayPhoto;

  // ----- Slamet: photo selection -----
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setPreviewUrl(dataUrl);
      // Bump status to pending so Siti knows a new photo is waiting for review
      if (status === 'no_receipt') setStatus('pending');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSlametSave = () => {
    if (previewUrl) {
      onUploadReceipt(expense.id, previewUrl);
    }
    onClose();
  };

  // ----- Siti: verification save -----
  const handleSitiSave = () => {
    onUpdateStatus(expense.id, status, note);
    onClose();
  };

  return (
    <>
      {/* Zoomed image lightbox */}
      {isImageZoomed && displayPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsImageZoomed(false)}
        >
          <img
            src={displayPhoto}
            alt="Receipt full size"
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setIsImageZoomed(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <div className="w-full max-w-2xl my-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {isSlamet ? 'Upload Receipt Proof' : 'Receipt Verification'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isSlamet
                  ? 'Slamet · attach a photo of the purchase receipt for Siti to verify'
                  : 'Siti Rahayu (Hong Kong) · review and verify Slamet\'s spending proof'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body: photo left, metadata + controls right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Photo panel ── */}
            <div className="flex flex-col gap-3">
              {/* Photo display / placeholder */}
              <div
                className={`relative rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center min-h-[220px] ${hasPhoto ? 'cursor-zoom-in' : ''}`}
                onClick={() => hasPhoto && setIsImageZoomed(true)}
              >
                {hasPhoto ? (
                  <>
                    <img
                      src={displayPhoto}
                      alt={expense.title}
                      className="max-h-72 w-auto object-contain rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <ZoomIn className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 text-neutral-400 space-y-2">
                    <Camera className="w-10 h-10 mx-auto opacity-30" />
                    <p className="text-xs">No receipt photo attached yet</p>
                  </div>
                )}
              </div>

              {/* Upload controls — Slamet only */}
              {isSlamet && (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-medium transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {hasPhoto ? 'Replace Photo' : 'Attach Receipt Photo'}
                  </button>

                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove new photo
                    </button>
                  )}

                  <p className="text-[11px] text-neutral-400 text-center">
                    JPG, PNG or HEIC · taken now or from gallery
                  </p>
                </div>
              )}

              {/* Siti: photo hint when no photo */}
              {isSiti && !hasPhoto && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Slamet hasn't uploaded a photo yet. You can still flag it for clarification to prompt him.</span>
                </div>
              )}
            </div>

            {/* ── Metadata + controls ── */}
            <div className="space-y-4 text-xs">
              {/* Expense details */}
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Item / Purpose</span>
                <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {expense.title}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700">
                <div>
                  <span className="text-neutral-400 text-[10px]">Amount (IDR)</span>
                  <div className="font-bold font-mono text-sm text-neutral-900 dark:text-neutral-100">
                    {formatCurrencyIdr(expense.amountIdr)}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400 text-[10px]">Date</span>
                  <div className="font-medium text-neutral-700 dark:text-neutral-300">
                    {formatDate(expense.date)}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400 text-[10px]">Vendor</span>
                  <div className="font-medium text-neutral-700 dark:text-neutral-300 truncate">
                    {expense.vendor}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400 text-[10px]">Category</span>
                  <div className="font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                    {t.categories[expense.categoryId]}
                  </div>
                </div>
              </div>

              {/* Slamet: current status display */}
              {isSlamet && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium border ${
                  expense.receiptStatus === 'verified'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : expense.receiptStatus === 'needs_clarification'
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                }`}>
                  {expense.receiptStatus === 'verified' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {expense.receiptStatus === 'verified'
                      ? 'Receipt verified by Siti ✓'
                      : expense.receiptStatus === 'needs_clarification'
                      ? 'Siti requested clarification — please re-upload a clearer photo'
                      : !expense.receiptUrl
                      ? 'No photo yet — upload a receipt photo so Siti can verify'
                      : 'Awaiting Siti\'s review in Hong Kong'}
                  </span>
                </div>
              )}

              {/* Siti: verification controls */}
              {isSiti && (
                <>
                  <div>
                    <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Verification Decision
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setStatus('verified')}
                        disabled={!hasPhoto}
                        title={!hasPhoto ? 'No photo to verify yet' : ''}
                        className={`flex items-center justify-center gap-1.5 p-2 rounded-lg font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          status === 'verified'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatus('needs_clarification')}
                        className={`flex items-center justify-center gap-1.5 p-2 rounded-lg font-medium border transition-colors ${
                          status === 'needs_clarification'
                            ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-500 text-orange-800 dark:text-orange-300'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
                        <span>Need Clarification</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Review Notes
                    </label>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={
                        hasPhoto
                          ? 'e.g. Receipt verified on Nov 5th via video call...'
                          : 'e.g. Slamet to upload purchase receipt tomorrow morning.'
                      }
                      className="w-full p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    />
                  </div>
                </>
              )}

              {/* Slamet: notes from Siti */}
              {isSlamet && expense.verificationNotes && (
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-0.5">
                    Siti's note:
                  </span>
                  "{expense.verificationNotes}"
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2 text-xs">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              {t.actions.cancel}
            </button>

            {isSlamet && (
              <button
                onClick={handleSlametSave}
                disabled={!previewUrl}
                className="px-4 py-2 font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {previewUrl ? 'Upload Receipt' : 'No Photo Selected'}
              </button>
            )}

            {isSiti && (
              <button
                onClick={handleSitiSave}
                className="px-4 py-2 font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors"
              >
                Save Verification
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
