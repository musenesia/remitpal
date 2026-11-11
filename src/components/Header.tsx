import React, { useState } from 'react';
import { Menu, Plus, Printer, ArrowRightLeft, ArrowLeftRight, Bell } from 'lucide-react';
import { ActiveTab, UserProfile, AppNotification } from '../types';
import { Translations } from '../i18n/translations';
import { formatMonthYear } from '../utils/formatters';
import { NotificationDropdown } from './NotificationDropdown';

interface HeaderProps {
  currentTab: ActiveTab;
  selectedMonth: string; // "all" or "YYYY-MM"
  availableMonths: string[];
  onSelectMonth: (month: string) => void;
  t: Translations;
  onOpenAddExpense: () => void;
  onOpenRecordRemittance: () => void;
  onPrint: () => void;
  onOpenMobileMenu: () => void;
  currentUser: UserProfile | null;
  onOpenAuthModal: () => void;
  onQuickSwitchUser: () => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  selectedMonth,
  availableMonths,
  onSelectMonth,
  t,
  onOpenAddExpense,
  onOpenRecordRemittance,
  onPrint,
  onOpenMobileMenu,
  currentUser,
  onOpenAuthModal,
  onQuickSwitchUser,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNavigateTab
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getTabTitle = (tab: ActiveTab) => {
    switch (tab) {
      case 'overview':
        return t.nav.overview;
      case 'expenses':
        return t.nav.expenses;
      case 'remittances':
        return t.nav.remittances;
      case 'receipts':
        return t.nav.receipts;
      case 'budget':
        return t.nav.budget;
      case 'calendar':
        return t.nav.calendar;
      case 'notifications':
        return t.nav.notifications || 'Activity & Notifications';
      case 'report':
        return t.nav.report;
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Mobile Hamburger + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 truncate">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
              RemitPal
            </span>
            <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">/</span>
            <span className="font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
              {getTabTitle(currentTab)}
            </span>
          </div>
        </div>

        {/* Zone 2: Month Filter & Active User Indicator */}
        <div className="hidden sm:flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 pl-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs">
              <span className={`w-2 h-2 rounded-full ${currentUser.role === 'remitter' ? 'bg-emerald-500' : 'bg-sky-500'}`} />
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {currentUser.name.split(' ')[0]}
              </span>
              <span className="text-[10px] text-neutral-400 uppercase font-mono">
                ({currentUser.role === 'remitter' ? 'HK' : 'ID'})
              </span>
              <button
                onClick={onQuickSwitchUser}
                title={`Switch to ${currentUser.username === 'siti' ? 'Slamet' : 'Siti'}`}
                className="ml-1 p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-300 transition-colors"
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="header-month-select" className="text-xs text-neutral-500 dark:text-neutral-400 font-medium whitespace-nowrap">
              Period:
            </label>
            <select
              id="header-month-select"
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="text-xs font-medium py-1.5 px-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">{t.filters.allMonths}</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthYear(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Zone 3: Primary Action Buttons + Notification Bell */}
        <div className="flex items-center gap-2 shrink-0 relative">
          {/* Notification Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Activity notifications"
              aria-label="Activity notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <NotificationDropdown
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
              notifications={notifications}
              onMarkAsRead={onMarkNotificationRead}
              onMarkAllAsRead={onMarkAllNotificationsRead}
              onViewAll={() => onNavigateTab('notifications')}
              onNavigateTab={onNavigateTab}
            />
          </div>

          <button
            onClick={onPrint}
            title={t.actions.printPdf}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden md:inline">{t.actions.printPdf}</span>
          </button>

          {currentUser?.role === 'remitter' && (
            <button
              onClick={onOpenRecordRemittance}
              className="hidden items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t.actions.recordRemittance}</span>
            </button>
          )}

          <button
            onClick={onOpenAddExpense}
            className="hidden items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-2xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t.actions.addExpense}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
