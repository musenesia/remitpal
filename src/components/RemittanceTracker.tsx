import React, { useState } from 'react';
import { 
  ArrowRightLeft, 
  Plus, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Building2, 
  Send,
  Calendar,
  Hash,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { AppData, RemittanceRecord, UserProfile } from '../types';
import { Translations } from '../i18n/translations';
import { formatCurrencyHkd, formatCurrencyIdr, formatDate } from '../utils/formatters';
import { sendPayPalPayout, getStoredAuth } from '../utils/api';

interface RemittanceTrackerProps {
  data: AppData;
  t: Translations;
  onAddRemittance: (record: RemittanceRecord) => void;
  currentUser: UserProfile | null;
  onOpenAuthModal: () => void;
}

export const RemittanceTracker: React.FC<RemittanceTrackerProps> = ({
  data,
  t,
  onAddRemittance,
  currentUser,
  onOpenAuthModal
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amountIdr, setAmountIdr] = useState(15000000);
  const [paypalAmount, setPaypalAmount] = useState(100);
  const [paypalCurrency, setPaypalCurrency] = useState('USD');
  const [notes, setNotes] = useState('Monthly salary remittance sent from Hong Kong via PayPal.');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const totalRemitted = data.remittances.reduce((sum, r) => sum + r.amountIdr, 0);

  const resetModal = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setAmountIdr(15000000);
    setPaypalAmount(100);
    setPaypalCurrency('USD');
    setNotes('Monthly salary remittance sent from Hong Kong via PayPal.');
    setSendError(null);
    setSending(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);

    // The PayPal payout requires an authenticated remitter session. The app
    // boots into a default Siti profile with no real token, so if there's no
    // session we open the auth modal first — the user one-click logs in as
    // Siti and retries. Form values are preserved while the modal is open.
    const { token } = getStoredAuth();
    if (!token) {
      setSendError('Please log in as Siti to send a remittance via PayPal.');
      onOpenAuthModal();
      return;
    }

    setSending(true);

    // Trigger the real PayPal payout to Slamet (server-side).
    const result = await sendPayPalPayout({
      amount: Number(paypalAmount),
      currency: paypalCurrency,
      note: notes,
    });

    if (!result.success || !result.payout) {
      const errMsg = result.error || 'PayPal payout failed. Please try again.';
      // A 401 means the session expired or was cleared (e.g. DB reset) —
      // prompt re-login instead of showing a cryptic server error.
      if (/unauthorized|session|token/i.test(errMsg)) {
        setSendError('Your session expired. Please log in as Siti again.');
        onOpenAuthModal();
      } else {
        setSendError(errMsg);
      }
      setSending(false);
      return;
    }

    const payout = result.payout;
    const isReceived = payout.batchStatus === 'SUCCESS' || payout.transactionStatus === 'SUCCESS';
    const currencyLabel = payout.amount?.currency || paypalCurrency.toUpperCase();
    const amountLabel = payout.amount?.value || Number(paypalAmount).toFixed(2);
    const mockTag = payout.mock ? ' (MOCK mode)' : '';

    // Build the ledger record from the PayPal result. The reference number is
    // the PayPal payout batch id, and the transfer service is always PayPal
    // (remittance can only be sent by Siti to Slamet via PayPal).
    const newRecord: RemittanceRecord = {
      id: `rem-${Date.now()}`,
      date,
      monthYear: date.slice(0, 7),
      amountIdr: Number(amountIdr),
      // Keep the HKD field accurate only when the payout was actually in HKD.
      amountHkd: currencyLabel === 'HKD' ? Number(amountLabel) : undefined,
      transferService: 'PayPal',
      sender: `${data.workerProfile.name} (Hong Kong)`,
      receiver: `${data.workerProfile.husbandName} (Indramayu)`,
      referenceNo: payout.payoutBatchId,
      notes: `${notes ? notes + ' ' : ''}Sent via PayPal (${currencyLabel} ${amountLabel})${mockTag}. PayPal Batch: ${payout.payoutBatchId}.`,
      status: isReceived ? 'received' : 'in_transit'
    };

    // Persist through the existing flow (local state + /api/remittances,
    // which also fires the activity notification + WhatsApp broadcast).
    onAddRemittance(newRecord);
    setSending(false);
    setShowAddModal(false);
    resetModal();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {t.nav.remittances}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
              Official records of remittances sent by Siti from Hong Kong to Indramayu. The standard agreed transfer is 15,000,000 IDR every month.
            </p>
          </div>

          {currentUser?.role === 'remitter' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{t.actions.recordRemittance}</span>
            </button>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Total Transferred to Date</span>
            <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
              {formatCurrencyIdr(totalRemitted)}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Standard Monthly Remit</span>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              Rp 15.000.000
            </div>
          </div>
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Total Batches Completed</span>
            <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
              {data.remittances.length} Batches
            </div>
          </div>
        </div>
      </div>

      {/* Remittance Batches List */}
      <div className="space-y-4">
        {data.remittances.map((rem) => (
          <div
            key={rem.id}
            className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800 shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      {rem.transferService}
                    </h4>
                    {rem.status === 'in_transit' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t.remittanceStatus.in_transit}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.remittanceStatus.received}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {rem.notes}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400 dark:text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(rem.date)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5" />
                      Ref: <strong className="font-mono text-neutral-600 dark:text-neutral-300">{rem.referenceNo}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>To: {rem.receiver}</span>
                  </div>
                </div>
              </div>

              <div className="text-left md:text-right shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100 dark:border-neutral-800">
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyIdr(rem.amountIdr)}
                </div>
                {rem.amountHkd && (
                  <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {formatCurrencyHkd(rem.amountHkd)} (Sent in HKD)
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Record Remittance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Send Remittance via PayPal
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Transfer Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Amount (IDR) — recorded in family ledger
                </label>
                <input
                  type="number"
                  value={amountIdr}
                  onChange={(e) => setAmountIdr(Number(e.target.value))}
                  required
                  step="100000"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* PayPal send section */}
              <div className="p-3 rounded-xl border border-[#0070ba]/30 dark:border-[#0070ba]/40 bg-[#0070ba]/5">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs font-bold text-[#003087] dark:text-[#3d7ff0]">PayPal</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">— sent to Slamet's PayPal account</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Send amount
                    </label>
                    <input
                      type="number"
                      value={paypalAmount}
                      onChange={(e) => setPaypalAmount(Number(e.target.value))}
                      required
                      step="0.01"
                      min="0.01"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-[#0070ba]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Currency
                    </label>
                    <select
                      value={paypalCurrency}
                      onChange={(e) => setPaypalCurrency(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-[#0070ba]"
                    >
                      <option value="USD">USD</option>
                      <option value="HKD">HKD</option>
                      <option value="IDR">IDR</option>
                    </select>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                  The payout is created via the PayPal Payouts API. The batch ID becomes the transaction reference.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {sendError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300">{sendError}</p>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetModal(); }}
                  disabled={sending}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 disabled:opacity-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-[#0070ba] hover:bg-[#005ea6] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending via PayPal…</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send via PayPal</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
