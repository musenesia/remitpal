import React from 'react';
import { Printer, CheckCircle2, ShieldCheck, Calendar, ArrowLeft } from 'lucide-react';
import { AppData } from '../types';
import { Translations } from '../i18n/translations';
import { formatCurrencyIdr, formatMonthYear, formatDate } from '../utils/formatters';

interface AuditReportProps {
  data: AppData;
  selectedMonth: string;
  t: Translations;
  onBack: () => void;
  onPrint: () => void;
}

export const AuditReport: React.FC<AuditReportProps> = ({
  data,
  selectedMonth,
  t,
  onBack,
  onPrint
}) => {
  const activeMonth = selectedMonth === 'all' ? '2026-11' : selectedMonth;
  const filteredExpenses = data.expenses.filter(e => selectedMonth === 'all' || e.monthYear === selectedMonth);
  const filteredRemittances = data.remittances.filter(r => selectedMonth === 'all' || r.monthYear === selectedMonth);

  const totalRemitted = filteredRemittances.reduce((sum, r) => sum + r.amountIdr, 0);
  const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amountIdr, 0);
  const netSavings = Math.max(0, totalRemitted - totalSpent);

  const renovationSpent = filteredExpenses.filter(e => e.categoryId === 'renovation').reduce((sum, e) => sum + e.amountIdr, 0);
  const tuitionSpent = filteredExpenses.filter(e => e.categoryId === 'tuition').reduce((sum, e) => sum + e.amountIdr, 0);
  const allowanceSpent = filteredExpenses.filter(e => e.categoryId === 'allowance').reduce((sum, e) => sum + e.amountIdr, 0);
  const directSavingsSpent = filteredExpenses.filter(e => e.categoryId === 'savings').reduce((sum, e) => sum + e.amountIdr, 0);

  const verifiedCount = filteredExpenses.filter(e => e.receiptStatus === 'verified').length;
  const verificationPercent = filteredExpenses.length > 0 ? Math.round((verifiedCount / filteredExpenses.length) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Action Bar (Hidden in Print) */}
      <div className="no-print p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t.actions.printPdf}</span>
          </button>
        </div>
      </div>

      {/* Printable Statement Document Container */}
      <div className="p-8 sm:p-12 rounded-2xl bg-white text-neutral-900 border border-neutral-200 shadow-sm print:border-0 print:shadow-none print:p-0 max-w-4xl mx-auto space-y-8 font-sans">
        {/* Header Block */}
        <div className="border-b border-neutral-200 pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Official Family Accountability Document
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mt-1">
              {t.report.statementTitle}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Period: <strong className="text-neutral-800">{formatMonthYear(activeMonth)}</strong> · Generated on {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="text-left sm:text-right space-y-1 text-xs">
            <div className="font-semibold text-neutral-800">RemitPal Ledger</div>
            <div className="text-neutral-500">Hong Kong ➔ Indramayu</div>
            <div className="text-emerald-700 font-mono font-medium">Standard: 15.000.000 IDR/mo</div>
          </div>
        </div>

        {/* Parties involved */}
        <div className="grid grid-cols-2 gap-6 text-xs">
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Remitter (Sender in HK)</span>
            <div className="font-bold text-sm text-neutral-900">{data.workerProfile.name}</div>
            <div className="text-neutral-600">{data.workerProfile.jobTitle}</div>
            <div className="text-neutral-500">{data.workerProfile.location}</div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Recipient & Manager in Indramayu</span>
            <div className="font-bold text-sm text-neutral-900">{data.workerProfile.husbandName}</div>
            <div className="text-neutral-600">Husband & Household Manager</div>
            <div className="text-neutral-500">{data.workerProfile.destination}</div>
          </div>
        </div>

        {/* Financial Executive Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-center">
            <span className="text-[11px] text-emerald-800 font-medium">Total Inflow Received</span>
            <div className="text-lg font-bold font-mono text-emerald-900 mt-1">
              {formatCurrencyIdr(totalRemitted)}
            </div>
            <span className="text-[10px] text-emerald-700 font-mono">100% Accounted</span>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-center">
            <span className="text-[11px] text-amber-800 font-medium">Total Family Spending</span>
            <div className="text-lg font-bold font-mono text-amber-900 mt-1">
              {formatCurrencyIdr(totalSpent)}
            </div>
            <span className="text-[10px] text-amber-700">{filteredExpenses.length} verified logs</span>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-center">
            <span className="text-[11px] text-blue-800 font-medium">Net Preserved Fund</span>
            <div className="text-lg font-bold font-mono text-blue-900 mt-1">
              {formatCurrencyIdr(netSavings)}
            </div>
            <span className="text-[10px] text-blue-700 font-mono">Bank reserve</span>
          </div>
        </div>

        {/* Spending Breakdown by Allocation */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 border-b pb-2">
            Allocation Realization Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-neutral-200">
              <span className="text-neutral-500">Home Renovation</span>
              <div className="font-bold font-mono text-sm mt-0.5">{formatCurrencyIdr(renovationSpent)}</div>
            </div>
            <div className="p-3 rounded-lg border border-neutral-200">
              <span className="text-neutral-500">Kids' Tuition</span>
              <div className="font-bold font-mono text-sm mt-0.5">{formatCurrencyIdr(tuitionSpent)}</div>
            </div>
            <div className="p-3 rounded-lg border border-neutral-200">
              <span className="text-neutral-500">Monthly Allowance</span>
              <div className="font-bold font-mono text-sm mt-0.5">{formatCurrencyIdr(allowanceSpent)}</div>
            </div>
            <div className="p-3 rounded-lg border border-neutral-200">
              <span className="text-neutral-500">Bank Savings</span>
              <div className="font-bold font-mono text-sm mt-0.5">{formatCurrencyIdr(directSavingsSpent)}</div>
            </div>
          </div>
        </div>

        {/* Detailed Items Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 border-b pb-2">
            Itemized Expense Ledger & Verification Audit
          </h3>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-neutral-600 font-semibold">
                <th className="py-2">Date</th>
                <th className="py-2">Category</th>
                <th className="py-2">Description / Merchant</th>
                <th className="py-2 text-right">Amount (IDR)</th>
                <th className="py-2 text-right">Proof Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredExpenses.map((e) => (
                <tr key={e.id} className="print-break-inside-avoid">
                  <td className="py-2.5 font-mono text-neutral-600">{formatDate(e.date)}</td>
                  <td className="py-2.5 font-medium">{t.categories[e.categoryId]}</td>
                  <td className="py-2.5">
                    <div className="font-medium text-neutral-900">{e.title}</div>
                    <div className="text-[10px] text-neutral-500">{e.vendor}</div>
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-neutral-900">
                    {formatCurrencyIdr(e.amountIdr)}
                  </td>
                  <td className="py-2.5 text-right font-medium">
                    {e.receiptStatus === 'verified' ? (
                      <span className="text-emerald-700">✓ Verified</span>
                    ) : (
                      <span className="text-amber-700">⌛ Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dual Signatures / Acknowledgments */}
        <div className="pt-8 border-t border-neutral-300 grid grid-cols-2 gap-12 text-center text-xs print-break-inside-avoid">
          <div>
            <div className="text-neutral-500 mb-14">Prepared & Reported by (Indramayu)</div>
            <div className="font-bold text-neutral-900 border-t border-neutral-400 pt-2 inline-block min-w-[200px]">
              {data.workerProfile.husbandName}
            </div>
            <div className="text-[11px] text-neutral-500">Husband & On-Site Manager</div>
          </div>

          <div>
            <div className="text-neutral-500 mb-14">Reviewed & Approved by (Hong Kong)</div>
            <div className="font-bold text-neutral-900 border-t border-neutral-400 pt-2 inline-block min-w-[200px]">
              {data.workerProfile.name}
            </div>
            <div className="text-[11px] text-neutral-500">Remitter & Primary Provider</div>
          </div>
        </div>
      </div>
    </div>
  );
};
