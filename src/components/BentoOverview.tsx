import React from 'react';
import { 
  ArrowUpRight, 
  Home, 
  GraduationCap, 
  ShoppingBag, 
  PiggyBank, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Receipt, 
  TrendingUp, 
  Calendar, 
  ShieldCheck,
  ChevronRight,
  Bell,
  ArrowRightLeft
} from 'lucide-react';
import { AppData, CategoryId, ExpenseItem, AppNotification } from '../types';
import { Translations } from '../i18n/translations';
import { formatCurrencyIdr, formatMonthYear, formatDate, formatCompactIdr } from '../utils/formatters';

interface BentoOverviewProps {
  data: AppData;
  selectedMonth: string;
  t: Translations;
  onSelectTab: (tab: any) => void;
  onOpenReceiptModal: (expense: ExpenseItem) => void;
  onOpenAddExpense: () => void;
  notifications?: AppNotification[];
}

export const BentoOverview: React.FC<BentoOverviewProps> = ({
  data,
  selectedMonth,
  t,
  onSelectTab,
  onOpenReceiptModal,
  onOpenAddExpense,
  notifications = []
}) => {
  // Filter expenses and remittances by selected month
  const filteredExpenses = selectedMonth === 'all'
    ? data.expenses
    : data.expenses.filter(e => e.monthYear === selectedMonth);

  const filteredRemittances = selectedMonth === 'all'
    ? data.remittances
    : data.remittances.filter(r => r.monthYear === selectedMonth);

  // Totals
  const totalRemitted = filteredRemittances.reduce((sum, r) => sum + r.amountIdr, 0);
  const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amountIdr, 0);
  const remainingCash = Math.max(0, totalRemitted - totalSpent);

  // Category aggregations
  const categoryTotals: Record<CategoryId, number> = {
    renovation: 0,
    tuition: 0,
    allowance: 0,
    savings: 0,
    miscellaneous: 0
  };

  filteredExpenses.forEach(e => {
    if (categoryTotals[e.categoryId] !== undefined) {
      categoryTotals[e.categoryId] += e.amountIdr;
    } else {
      categoryTotals.miscellaneous += e.amountIdr;
    }
  });

  // Calculate current month's planned budget targets
  const currentBudget = data.budgets.find(b => b.monthYear === (selectedMonth === 'all' ? '2026-11' : selectedMonth)) || data.budgets[0];
  const multiplier = selectedMonth === 'all' ? (data.budgets.length || 1) : 1;

  const plannedTargets: Record<CategoryId, number> = {
    renovation: (currentBudget?.allocations.renovation || 5000000) * multiplier,
    tuition: (currentBudget?.allocations.tuition || 3500000) * multiplier,
    allowance: (currentBudget?.allocations.allowance || 4000000) * multiplier,
    savings: (currentBudget?.allocations.savings || 2500000) * multiplier,
    miscellaneous: 0
  };

  // Receipt stats
  const totalReceipts = filteredExpenses.length;
  const verifiedReceipts = filteredExpenses.filter(e => e.receiptStatus === 'verified').length;
  const pendingReceipts = filteredExpenses.filter(e => e.receiptStatus === 'pending').length;
  const verificationRate = totalReceipts > 0 ? Math.round((verifiedReceipts / totalReceipts) * 100) : 100;

  // Monthly Chart data calculation (all available months)
  const allMonths = Array.from(new Set([...data.remittances.map(r => r.monthYear), ...data.expenses.map(e => e.monthYear)])).sort();
  const monthlyStats = allMonths.map(m => {
    const rem = data.remittances.filter(r => r.monthYear === m).reduce((acc, curr) => acc + curr.amountIdr, 0);
    const exp = data.expenses.filter(e => e.monthYear === m).reduce((acc, curr) => acc + curr.amountIdr, 0);
    return {
      monthYear: m,
      remitted: rem,
      spent: exp,
      saved: Math.max(0, rem - exp)
    };
  });

  const categoryIcons: Record<CategoryId, React.ReactNode> = {
    renovation: <Home className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    tuition: <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    allowance: <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    savings: <PiggyBank className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
    miscellaneous: <Receipt className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
  };

  const categoryBg: Record<CategoryId, string> = {
    renovation: 'bg-amber-500',
    tuition: 'bg-blue-500',
    allowance: 'bg-emerald-500',
    savings: 'bg-purple-500',
    miscellaneous: 'bg-neutral-500'
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Bento Card: Hong Kong to Indramayu Remittance Channel */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white relative overflow-hidden shadow-xs border border-neutral-700/50">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>{t.profile.workerLocation}</span>
              <span aria-hidden="true">➔</span>
              <span>{t.profile.familyLocation}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-mono">15,000,000 IDR/mo</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              {t.overview.heroTitle}
            </h2>

            <p className="text-sm text-neutral-300 max-w-xl leading-relaxed">
              {t.overview.heroDesc} Dedicated allocation for home renovation, kid's schooling, living costs, and guaranteed savings.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/80">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Managed by: <strong className="text-white font-medium">{data.workerProfile.husbandName}</strong></span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/80">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <span>Period: <strong className="text-white font-medium">{selectedMonth === 'all' ? t.filters.allMonths : formatMonthYear(selectedMonth)}</strong></span>
              </div>
              <button 
                onClick={() => onSelectTab('calendar')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-300 transition-colors cursor-pointer"
              >
                <span>Transfer & Task Schedule ➔</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="p-4 rounded-xl bg-neutral-800/90 border border-neutral-700/90 backdrop-blur-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-neutral-400">Monthly Deposit Target</span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                  Rp 15.000.000
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-neutral-400">HKD Remittance Equiv.</span>
                <div className="text-sm font-mono text-neutral-200 mt-0.5">
                  ~HK$ 7,500
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-neutral-400">Receipt Verification</span>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {verificationRate}% Verified
                </div>
              </div>
              <div className="p-3 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-neutral-400">Husband Log Status</span>
                <div className="text-base font-bold text-white mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Up to Date</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bento Key Metrics Strip (4 tiles) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Remitted */}
        <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>{t.overview.totalRemitted}</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
              Rp
            </span>
          </div>
          <div className="mt-2 text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
            {formatCurrencyIdr(totalRemitted)}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <span>{filteredRemittances.length} transfers received</span>
          </div>
        </div>

        {/* Total Spent */}
        <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>{t.overview.totalSpent}</span>
            <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
            {formatCurrencyIdr(totalSpent)}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{filteredExpenses.length} documented expenditures</span>
          </div>
        </div>

        {/* Remaining Cash in Indramayu */}
        <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>{t.overview.allocatedRemaining}</span>
            <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-mono text-xs font-bold">
              %
            </span>
          </div>
          <div className="mt-2 text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
            {formatCurrencyIdr(remainingCash)}
          </div>
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <span>Safe operating cushion</span>
          </div>
        </div>

        {/* Total Saved / Emergency Reserve */}
        <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>{t.overview.accumulatedSavings}</span>
            <span className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
            {formatCurrencyIdr(categoryTotals.savings)}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>Preserved in BRI Bank account</span>
          </div>
        </div>
      </div>

      {/* 3. Main Bento Grid: Budget vs Actual Allocations & Spending Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: 4 Core Budget Allocations vs Actual Progress */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {t.overview.budgetVsActual}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Target allocation: 15 Million IDR per month standard rule
              </p>
            </div>
            <button
              onClick={() => onSelectTab('budget')}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
            >
              <span>{t.overview.viewAll}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {(['renovation', 'tuition', 'allowance', 'savings'] as CategoryId[]).map((catId) => {
              const spent = categoryTotals[catId];
              const planned = plannedTargets[catId];
              const percent = planned > 0 ? Math.min(100, Math.round((spent / planned) * 100)) : 0;
              const isOver = spent > planned;

              return (
                <div key={catId} className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 shadow-2xs">
                        {categoryIcons[catId]}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {t.categories[catId]}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {t.categoryDescriptions[catId]}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                        {formatCurrencyIdr(spent)}
                      </div>
                      <div className="text-xs font-mono text-neutral-400">
                        of {formatCurrencyIdr(planned)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : categoryBg[catId]}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>{percent}% executed</span>
                      {isOver ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {t.overview.overBudget} (+{formatCurrencyIdr(spent - planned)})
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyIdr(planned - spent)} remaining
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Columns: Visual Renovation Progress & Receipt Vault Spotlight */}
        <div className="lg:col-span-5 space-y-6">
          {/* Bento Tile: Indramayu Family House Renovation Spotlight */}
          <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs overflow-hidden">
            <div className="relative h-44 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              <img 
                src="/src/assets/images/family_house_indramayu_1794285314079.jpg" 
                alt="Indramayu Family Home Renovation" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-4 text-white">
                <span className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
                  Family Milestone
                </span>
                <h4 className="text-base font-bold text-white">
                  Indramayu House Renovation
                </h4>
                <p className="text-xs text-neutral-200 line-clamp-1">
                  Terrace tiling, new terracotta roof, and bedroom plastered
                </p>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Total Spent on Materials & Labor:</span>
                <span className="font-bold font-mono text-neutral-900 dark:text-neutral-100">
                  {formatCurrencyIdr(categoryTotals.renovation)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Supervised on-site by:</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {data.workerProfile.husbandName}
                </span>
              </div>
            </div>
          </div>

          {/* Bento Tile: Receipt Transparency & Accountability */}
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Receipt Verification Status
                </h4>
              </div>
              <button
                onClick={() => onSelectTab('receipts')}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
              >
                <span>View Vault</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50">
                <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  {verifiedReceipts}
                </div>
                <div className="text-[11px] text-emerald-800 dark:text-emerald-400 font-medium mt-0.5">
                  Verified
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/50">
                <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">
                  {pendingReceipts}
                </div>
                <div className="text-[11px] text-amber-800 dark:text-amber-400 font-medium mt-0.5">
                  Pending Photo
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700">
                <div className="text-lg font-bold font-mono text-neutral-700 dark:text-neutral-300">
                  {verificationRate}%
                </div>
                <div className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium mt-0.5">
                  Audit Rate
                </div>
              </div>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Every expense logged by husband Slamet requires vendor receipt slips, school receipts, or signed wage notes to ensure complete trust for Siti in Hong Kong.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Monthly Trend Chart (SVG) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Monthly Remittance vs Spending History
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Consistency tracking of 15 Million IDR remittance & husband's spending
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <span className="w-3 h-3 rounded bg-emerald-600" />
              <span>Remittance (HK)</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span>Family Expenses</span>
            </div>
          </div>
        </div>

        {/* Crisp Responsive SVG Bar Chart */}
        <div className="w-full h-56 pt-4">
          <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
            {/* Horizontal Grid lines */}
            <line x1="40" y1="20" x2="580" y2="20" stroke="currentColor" className="text-neutral-100 dark:text-neutral-800" strokeWidth="1" />
            <line x1="40" y1="70" x2="580" y2="70" stroke="currentColor" className="text-neutral-100 dark:text-neutral-800" strokeWidth="1" />
            <line x1="40" y1="120" x2="580" y2="120" stroke="currentColor" className="text-neutral-100 dark:text-neutral-800" strokeWidth="1" />
            <line x1="40" y1="170" x2="580" y2="170" stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" strokeWidth="1" />

            {/* Y axis labels */}
            <text x="35" y="25" textAnchor="end" className="text-[10px] fill-neutral-400 font-mono">15M</text>
            <text x="35" y="75" textAnchor="end" className="text-[10px] fill-neutral-400 font-mono">10M</text>
            <text x="35" y="125" textAnchor="end" className="text-[10px] fill-neutral-400 font-mono">5M</text>
            <text x="35" y="175" textAnchor="end" className="text-[10px] fill-neutral-400 font-mono">0</text>

            {/* Bars for each month */}
            {monthlyStats.map((st, i) => {
              const xBase = 100 + i * 160;
              // 15M maps to y=20 (height 150), so scale = 150 / 15000000 = 0.00001
              const remH = Math.min(150, (st.remitted / 15000000) * 150);
              const expH = Math.min(150, (st.spent / 15000000) * 150);
              const remY = 170 - remH;
              const expY = 170 - expH;

              return (
                <g key={st.monthYear}>
                  {/* Remitted Bar */}
                  <rect
                    x={xBase}
                    y={remY}
                    width="32"
                    height={remH}
                    rx="4"
                    className="fill-emerald-600 dark:fill-emerald-500"
                  />
                  {/* Spent Bar */}
                  <rect
                    x={xBase + 38}
                    y={expY}
                    width="32"
                    height={expH}
                    rx="4"
                    className="fill-amber-500 dark:fill-amber-400"
                  />

                  {/* Month Label */}
                  <text
                    x={xBase + 35}
                    y="190"
                    textAnchor="middle"
                    className="text-[11px] fill-neutral-600 dark:fill-neutral-400 font-medium"
                  >
                    {formatMonthYear(st.monthYear).split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 5. Recent Family Expenses & Family Activity Notifications Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Col 1: Recent Family Expenses */}
        <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {t.overview.recentTransactions}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Latest items logged by husband in Indramayu
              </p>
            </div>

            <button
              onClick={() => onSelectTab('expenses')}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
            >
              <span>{t.overview.viewAll}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredExpenses.slice(0, 4).map((exp) => (
              <div key={exp.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700 shrink-0">
                    {categoryIcons[exp.categoryId]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {exp.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{formatDate(exp.date)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{exp.vendor}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                      {formatCurrencyIdr(exp.amountIdr)}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {exp.receiptStatus === 'verified' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {exp.receiptUrl ? (
                    <button
                      onClick={() => onOpenReceiptModal(exp)}
                      title="View Receipt Proof"
                      className="w-8 h-8 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0 hover:ring-2 hover:ring-emerald-500 transition-all"
                    >
                      <img 
                        src={exp.receiptUrl} 
                        alt="receipt" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400">
                      <Receipt className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Col 2: Live Family Activity & Notifications */}
        <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Family Activity Feed
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Transfers, uploaded receipts & approvals
                  </p>
                </div>
              </div>

              <button
                onClick={() => onSelectTab('notifications')}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {notifications.slice(0, 4).map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => onSelectTab('notifications')}
                  className="py-3 flex items-start justify-between gap-3 cursor-pointer group hover:bg-neutral-50 dark:hover:bg-neutral-800/40 -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      notif.actor === 'siti'
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                        : 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300'
                    }`}>
                      {notif.type.includes('remittance') ? (
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      ) : notif.type.includes('receipt') ? (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Receipt className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {notif.title}
                        </span>
                        {!notif.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                        {notif.description}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] text-neutral-400 font-mono shrink-0 whitespace-nowrap mt-1">
                    {new Date(notif.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => onSelectTab('notifications')}
              className="w-full py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors flex items-center justify-center gap-1"
            >
              <span>Explore all notifications & audit events</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
