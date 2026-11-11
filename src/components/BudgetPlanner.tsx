import React, { useState } from 'react';
import { 
  PieChart, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Home, 
  GraduationCap, 
  ShoppingBag, 
  PiggyBank, 
  Receipt,
  RotateCcw
} from 'lucide-react';
import { AppData, CategoryId, MonthlyBudget } from '../types';
import { Translations } from '../i18n/translations';
import { formatCurrencyIdr, formatMonthYear } from '../utils/formatters';

interface BudgetPlannerProps {
  data: AppData;
  selectedMonth: string;
  availableMonths: string[];
  t: Translations;
  onUpdateBudget: (budget: MonthlyBudget) => void;
}

export const BudgetPlanner: React.FC<BudgetPlannerProps> = ({
  data,
  selectedMonth,
  availableMonths,
  t,
  onUpdateBudget
}) => {
  const activeMonth = selectedMonth === 'all' ? (availableMonths[0] || '2026-11') : selectedMonth;
  const currentBudget = data.budgets.find(b => b.monthYear === activeMonth) || {
    monthYear: activeMonth,
    totalRemittancePlanned: 15000000,
    allocations: {
      renovation: 5000000,
      tuition: 3500000,
      allowance: 4000000,
      savings: 2500000,
      miscellaneous: 0
    },
    notes: 'Standard 15M monthly allocation agreed between Siti and husband Slamet.'
  };

  const [allocations, setAllocations] = useState<Record<CategoryId, number>>({ ...currentBudget.allocations });
  const [totalTarget, setTotalTarget] = useState(currentBudget.totalRemittancePlanned || 15000000);
  const [notes, setNotes] = useState(currentBudget.notes || '');
  const [isSaved, setIsSaved] = useState(false);

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  const difference = totalTarget - totalAllocated;
  const isBalanced = difference === 0;

  const handleSliderChange = (catId: CategoryId, value: number) => {
    setAllocations(prev => ({
      ...prev,
      [catId]: value
    }));
    setIsSaved(false);
  };

  const handleResetToStandard = () => {
    setTotalTarget(15000000);
    setAllocations({
      renovation: 5000000,
      tuition: 3500000,
      allowance: 4000000,
      savings: 2500000,
      miscellaneous: 0
    });
    setIsSaved(false);
  };

  const handleSave = () => {
    const updated: MonthlyBudget = {
      monthYear: activeMonth,
      totalRemittancePlanned: totalTarget,
      allocations,
      notes
    };
    onUpdateBudget(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const categoryIcons: Record<CategoryId, React.ReactNode> = {
    renovation: <Home className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    tuition: <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    allowance: <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    savings: <PiggyBank className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
    miscellaneous: <Receipt className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {t.nav.budget}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
              Plan and balance the distribution of the 15,000,000 IDR sent from Hong Kong for {formatMonthYear(activeMonth)}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToStandard}
              className="hidden items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Standard 15M Split</span>
            </button>
            <button
              onClick={handleSave}
              className="hidden items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t.actions.save}</span>
            </button>
          </div>
        </div>

        {/* Balance Status Indicator */}
        <div className={`mt-6 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isBalanced 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' 
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {isBalanced ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div>
              <div className="text-xs font-semibold">
                {isBalanced ? 'Budget Perfectly Balanced' : 'Unallocated Discrepancy'}
              </div>
              <div className="text-[11px] opacity-80">
                {isBalanced 
                  ? 'All 15 Million Rupiahs are accounted for across renovation, tuition, living, and savings.' 
                  : difference > 0 
                    ? `Rp ${Math.abs(difference).toLocaleString()} remains unallocated.` 
                    : `Over-allocated by Rp ${Math.abs(difference).toLocaleString()}.`}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider opacity-70">Total Planned</span>
            <div className="text-base font-bold font-mono">
              {formatCurrencyIdr(totalAllocated)} / {formatCurrencyIdr(totalTarget)}
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Sliders & Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(['renovation', 'tuition', 'allowance', 'savings', 'miscellaneous'] as CategoryId[]).map((catId) => {
          const amount = allocations[catId] || 0;
          const percentage = totalTarget > 0 ? Math.round((amount / totalTarget) * 100) : 0;

          return (
            <div 
              key={catId} 
              className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700">
                    {categoryIcons[catId]}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {t.categories[catId]}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t.categoryDescriptions[catId]}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                    {percentage}%
                  </div>
                </div>
              </div>

              {/* Slider & Input */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="15000000"
                  step="250000"
                  value={amount}
                  onChange={(e) => handleSliderChange(catId, Number(e.target.value))}
                  className="w-full h-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 appearance-none cursor-pointer accent-emerald-600"
                />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-neutral-400 font-mono">0</span>
                  <div className="relative w-44">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-mono">Rp</span>
                    <input
                      type="number"
                      step="50000"
                      value={amount}
                      onChange={(e) => handleSliderChange(catId, Number(e.target.value))}
                      className="w-full pl-8 pr-2 py-1.5 text-xs font-mono font-medium rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-right focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">15M</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Monthly Planning Notes Card */}
        <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Family Notes & Directives from Hong Kong
          </h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Special instructions for husband Slamet regarding purchases or schedule.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full p-3 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            placeholder="e.g. Please prioritize paying Rizky's school tuition before buying more tiles..."
          />
        </div>
      </div>
    </div>
  );
};
