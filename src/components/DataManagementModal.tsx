import React, { useRef, useState } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileJson, 
  RotateCcw, 
  HardDrive, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { AppData } from '../types';
import { Translations } from '../i18n/translations';
import { 
  exportToJson, 
  importFromJson, 
  exportExpensesToCsv, 
  importExpensesFromCsv, 
  resetAppData 
} from '../utils/storage';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  onDataReplaced: (newData: AppData) => void;
  onResetDatabase?: () => Promise<void>;
  t: Translations;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  data,
  onDataReplaced,
  onResetDatabase,
  t
}) => {
  if (!isOpen) return null;

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleExportJson = () => {
    exportToJson(data);
    showFeedback('JSON backup downloaded successfully.');
  };

  const handleExportCsv = () => {
    exportExpensesToCsv(data.expenses, data.remittances);
    showFeedback('CSV spreadsheet downloaded successfully.');
  };

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imported = await importFromJson(file);
        onDataReplaced(imported);
        showFeedback(t.messages.importSuccess, 'success');
      } catch (err: any) {
        showFeedback(t.messages.importFailed + (err?.message ? ` (${err.message})` : ''), 'error');
      }
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imported = await importExpensesFromCsv(file, data);
        onDataReplaced(imported);
        showFeedback('CSV expenses merged into current database.', 'success');
      } catch (err: any) {
        showFeedback('Failed to read CSV: ' + err?.message, 'error');
      }
    }
  };

  const handlePerformReset = async () => {
    if (onResetDatabase) {
      await onResetDatabase();
    } else {
      const fresh = resetAppData();
      onDataReplaced(fresh);
    }
    setConfirmReset(false);
    showFeedback(t.messages.dataReset, 'success');
  };

  // Estimate storage usage
  const storageBytes = JSON.stringify(data).length;
  const storageKb = (storageBytes / 1024).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl my-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {t.nav.settings}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            <Check className="w-4 h-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Storage Health Info */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700 flex items-center justify-between text-xs">
          <div>
            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
              Offline LocalStorage Engine
            </div>
            <div className="text-neutral-500 dark:text-neutral-400 mt-0.5">
              Current Database Size: <strong className="font-mono text-neutral-800 dark:text-neutral-200">{storageKb} KB</strong> · 100% Private & In-Browser
            </div>
          </div>
          <span className="px-2 py-0.5 text-[11px] rounded-md font-mono bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
            Active
          </span>
        </div>

        {/* Export / Import Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Export & Download Data
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleExportJson}
              className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-left transition-colors flex items-center gap-3 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {t.actions.downloadJson}
                </div>
                <div className="text-[11px] text-neutral-500">
                  Full backup schema & photos
                </div>
              </div>
            </button>

            <button
              onClick={handleExportCsv}
              className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-left transition-colors flex items-center gap-3 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {t.actions.downloadCsv}
                </div>
                <div className="text-[11px] text-neutral-500">
                  Open in Excel / Google Sheets
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Import Data From Device
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* JSON Upload */}
            <label className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-left transition-colors flex items-center gap-3 cursor-pointer">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {t.actions.uploadJson}
                </div>
                <div className="text-[11px] text-neutral-500">
                  Restore from JSON backup
                </div>
              </div>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json"
                onChange={handleJsonUpload}
                className="hidden"
              />
            </label>

            {/* CSV Upload */}
            <label className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-left transition-colors flex items-center gap-3 cursor-pointer">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {t.actions.uploadCsv}
                </div>
                <div className="text-[11px] text-neutral-500">
                  Import rows from CSV
                </div>
              </div>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Reset Demo Data */}
        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {t.actions.resetDemo}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Restore the default Hong Kong ➔ Indramayu demonstration scenario
              </div>
            </div>

            {confirmReset ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePerformReset}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-xs"
                >
                  Confirm Reset
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
