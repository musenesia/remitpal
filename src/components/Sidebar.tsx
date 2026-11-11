import React from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  ArrowRightLeft, 
  Image as ImageIcon, 
  PieChart, 
  FileText, 
  Sun, 
  Moon,
  Calendar,
  X,
  User,
  LogOut,
  ArrowLeftRight,
  Bell
} from 'lucide-react';
import { ActiveTab, AppData, UserProfile } from '../types';
import { Translations } from '../i18n/translations';

interface SidebarProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  t: Translations;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenDataModal: () => void;
  data: AppData;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser: UserProfile | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  isDbConnected: boolean;
  unreadNotificationsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  t,
  isDark,
  onToggleTheme,
  onOpenDataModal,
  data,
  isMobileOpen,
  onCloseMobile,
  currentUser,
  onOpenAuthModal,
  onLogout,
  isDbConnected,
  unreadNotificationsCount
}) => {
  const pendingTasksCount = data.calendarEvents ? data.calendarEvents.filter(e => !e.isCompleted).length : 0;

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badgeCount?: number }[] = [
    { id: 'overview', label: t.nav.overview, icon: <LayoutDashboard className="w-4 h-4" /> },
    { 
      id: 'expenses', 
      label: t.nav.expenses, 
      icon: <ReceiptText className="w-4 h-4" />,
      badgeCount: data.expenses.length 
    },
    { 
      id: 'remittances', 
      label: t.nav.remittances, 
      icon: <ArrowRightLeft className="w-4 h-4" />,
      badgeCount: data.remittances.length
    },
    { 
      id: 'receipts', 
      label: t.nav.receipts, 
      icon: <ImageIcon className="w-4 h-4" />,
      badgeCount: data.expenses.filter(e => !!e.receiptUrl).length
    },
    { id: 'budget', label: t.nav.budget, icon: <PieChart className="w-4 h-4" /> },
    { 
      id: 'calendar', 
      label: t.nav.calendar, 
      icon: <Calendar className="w-4 h-4" />,
      badgeCount: pendingTasksCount
    },
    { 
      id: 'notifications', 
      label: t.nav.notifications || 'Notifications', 
      icon: <Bell className="w-4 h-4" />,
      badgeCount: unreadNotificationsCount
    },
    { id: 'report', label: t.nav.report, icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col justify-between transition-transform duration-200 ease-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header & Logo */}
          <div className="p-6 pb-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                R
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-none">
                  {t.appName}
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  HK · Indramayu Ledger
                </p>
              </div>
            </div>

            <button 
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active User Card & Switcher (Siti / Slamet Auth) */}
          <div className="p-4 mx-4 my-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60">
            {currentUser ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  {currentUser.avatarUrl ? (
                    <img 
                      src={currentUser.avatarUrl} 
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {currentUser.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {currentUser.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        currentUser.role === 'remitter'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300'
                      }`}>
                        {currentUser.role === 'remitter' ? 'Remitter · HK' : 'Manager · Indramayu'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                      {currentUser.location}
                    </p>
                  </div>
                </div>

                {/* Account Switcher Bar */}
                <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between text-xs">
                  <button
                    onClick={onOpenAuthModal}
                    className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>Switch to {currentUser.username === 'siti' ? 'Slamet' : 'Siti'}</span>
                  </button>
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1 text-neutral-400 hover:text-rose-600 transition-colors"
                    title="Log Out"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-500">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      Not Signed In
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Sign in as Siti or Slamet
                    </p>
                  </div>
                </div>
                <button
                  onClick={onOpenAuthModal}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Navigation
            </div>
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-white' : 'text-neutral-500 dark:text-neutral-400'}>
                      {item.icon}
                    </span>
                    <span className="whitespace-nowrap">{item.label}</span>
                  </div>

                  {item.badgeCount !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                      isActive 
                        ? 'bg-emerald-700/80 text-white' 
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}>
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Controls: Theme, Live Badges & Storage indicator */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          {/* Live Integration Badges */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">Gemini · LIVE</span>
            </div>
            <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 truncate">PayPal · LIVE</span>
            </div>
          </div>

          {/* Dark / Light Mode Switch */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span>Theme</span>
            </div>
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>

          {/* DB Status Indicator */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isDbConnected ? 'PostgreSQL (connected)' : 'Offline (LocalStorage)'}</span>
            </div>
            <span className="font-mono text-[10px]">Active</span>
          </div>
        </div>
      </aside>
    </>
  );
};
