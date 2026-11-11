import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  CheckCheck, 
  ArrowRightLeft, 
  Receipt, 
  Image as ImageIcon, 
  ShieldCheck, 
  AlertCircle, 
  CheckSquare, 
  PieChart, 
  Trash2, 
  User, 
  Sparkles,
  ExternalLink,
  Search,
  CheckCircle2
} from 'lucide-react';
import { AppNotification, ActiveTab } from '../types';
import { formatCurrencyIdr } from '../utils/formatters';

interface NotificationFeedProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const NotificationFeed: React.FC<NotificationFeedProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onNavigateTab
}) => {
  const [actorFilter, setActorFilter] = useState<'all' | 'siti' | 'slamet'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'remittance' | 'receipt' | 'expense' | 'task'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Unread count
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  // Siti & Slamet event breakdown
  const sitiCount = useMemo(() => notifications.filter(n => n.actor === 'siti').length, [notifications]);
  const slametCount = useMemo(() => notifications.filter(n => n.actor === 'slamet').length, [notifications]);

  // Filtered list
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (showUnreadOnly && item.isRead) return false;
      if (actorFilter !== 'all' && item.actor !== actorFilter) return false;

      if (typeFilter === 'remittance' && !item.type.includes('remittance')) return false;
      if (typeFilter === 'receipt' && !item.type.includes('receipt')) return false;
      if (typeFilter === 'expense' && !item.type.includes('expense')) return false;
      if (typeFilter === 'task' && !item.type.includes('task') && !item.type.includes('budget')) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesActor = item.actorName.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesActor) return false;
      }

      return true;
    });
  }, [notifications, actorFilter, typeFilter, showUnreadOnly, searchQuery]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'remittance_sent':
        return <ArrowRightLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'remittance_received':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'receipt_uploaded':
        return <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'receipt_verified':
        return <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'receipt_flagged':
        return <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'task_completed':
        return <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'budget_updated':
        return <PieChart className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <Receipt className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'remittance_sent':
      case 'remittance_received':
        return 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60';
      case 'receipt_uploaded':
        return 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60';
      case 'receipt_verified':
        return 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800/60';
      case 'receipt_flagged':
        return 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60';
      case 'task_completed':
        return 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800/60';
      case 'budget_updated':
        return 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/60';
      default:
        return 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800/60';
    }
  };

  const handleActionClick = (item: AppNotification) => {
    if (!item.isRead) {
      onMarkAsRead(item.id);
    }
    if (item.type.includes('remittance')) {
      onNavigateTab('remittances');
    } else if (item.type.includes('receipt')) {
      onNavigateTab('receipts');
    } else if (item.type.includes('task')) {
      onNavigateTab('calendar');
    } else if (item.type.includes('expense')) {
      onNavigateTab('expenses');
    }
  };

  return (
    <div className="space-y-6">
      {/* Bento Top Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Events */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Total Logged Events
            </span>
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-3">
            {notifications.length}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Real-time family actions audit log
          </p>
        </div>

        {/* Card 2: Unread Items */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Unread Updates
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-3">
            {unreadCount}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {unreadCount === 0 ? 'All caught up!' : 'Pending your review'}
          </p>
        </div>

        {/* Card 3: Siti in HK */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Siti (Hong Kong)
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              Remitter
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3">
            {sitiCount}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Remittances sent & receipts verified
          </p>
        </div>

        {/* Card 4: Slamet in Indramayu */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Slamet (Indramayu)
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
              Manager
            </span>
          </div>
          <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-3">
            {slametCount}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Expenses recorded & receipts uploaded
          </p>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Mark All As Read */}
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications by title, vendor, or note..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
            {/* Filter by Unread Only */}
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                showUnreadOnly
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Unread only ({unreadCount})
            </button>

            {/* Mark All Read Button */}
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mr-1">
            Filter by:
          </span>

          {/* Actor Filter */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setActorFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                actorFilter === 'all'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              All Family
            </button>
            <button
              onClick={() => setActorFilter('siti')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                actorFilter === 'siti'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Siti (HK)
            </button>
            <button
              onClick={() => setActorFilter('slamet')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                actorFilter === 'slamet'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Slamet (Indramayu)
            </button>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                typeFilter === 'all'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('remittance')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                typeFilter === 'remittance'
                  ? 'bg-white dark:bg-neutral-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Remittances
            </button>
            <button
              onClick={() => setTypeFilter('receipt')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                typeFilter === 'receipt'
                  ? 'bg-white dark:bg-neutral-700 text-amber-700 dark:text-amber-300 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Receipts
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                typeFilter === 'expense'
                  ? 'bg-white dark:bg-neutral-700 text-sky-700 dark:text-sky-300 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setTypeFilter('task')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                typeFilter === 'task'
                  ? 'bg-white dark:bg-neutral-700 text-purple-700 dark:text-purple-300 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Tasks
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="w-12 h-12 mx-auto rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
              No notifications found
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
              {searchQuery || actorFilter !== 'all' || typeFilter !== 'all' || showUnreadOnly
                ? 'Try clearing the search or filter filters to see more events.'
                : 'Family actions, transfers, and uploaded receipts will appear here in chronological order.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const dateObj = new Date(item.timestamp);
            const formattedTime = dateObj.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={item.id}
                className={`p-4.5 rounded-2xl border transition-all ${
                  item.isRead
                    ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800/80'
                    : 'bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left Icon */}
                  <div className={`p-2.5 rounded-xl border shrink-0 ${getNotificationBg(item.type)}`}>
                    {getNotificationIcon(item.type)}
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        item.actor === 'siti'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300'
                      }`}>
                        {item.actorName} · {item.actor === 'siti' ? 'Hong Kong' : 'Indramayu'}
                      </span>

                      {!item.isRead && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded">
                          New
                        </span>
                      )}

                      <span className="text-[11px] text-neutral-400 ml-auto font-mono">
                        {formattedTime}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-1.5">
                      {item.title}
                    </h4>

                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>

                    {item.amountIdr !== undefined && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                          {formatCurrencyIdr(item.amountIdr)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleActionClick(item)}
                      title="View related section"
                      className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onDeleteNotification(item.id)}
                      title="Delete event"
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
