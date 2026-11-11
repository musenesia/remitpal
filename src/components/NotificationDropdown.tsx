import React, { useRef, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  ArrowRightLeft, 
  Receipt, 
  Image as ImageIcon, 
  ShieldCheck, 
  AlertCircle, 
  CheckSquare, 
  ArrowRight,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { AppNotification, ActiveTab } from '../types';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onViewAll: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewAll,
  onNavigateTab
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const recentNotifications = notifications.slice(0, 5);

  const getIcon = (type: string) => {
    switch (type) {
      case 'remittance_sent':
        return <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />;
      case 'remittance_received':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'receipt_uploaded':
        return <ImageIcon className="w-3.5 h-3.5 text-amber-600" />;
      case 'receipt_verified':
        return <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />;
      case 'receipt_flagged':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-600" />;
      case 'task_completed':
        return <CheckSquare className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Receipt className="w-3.5 h-3.5 text-sky-600" />;
    }
  };

  const handleClickItem = (item: AppNotification) => {
    if (!item.isRead) {
      onMarkAsRead(item.id);
    }
    onClose();
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
    <div 
      ref={dropdownRef}
      className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="p-4 pb-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-none">
              Family Activity
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {unreadCount} unread update{unreadCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <CheckCheck className="w-3 h-3" />
            <span>Mark read</span>
          </button>
        )}
      </div>

      {/* Notifications Items */}
      <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
        {recentNotifications.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-400">
            No recent activity logged.
          </div>
        ) : (
          recentNotifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleClickItem(item)}
              className={`p-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors flex items-start gap-3 ${
                !item.isRead ? 'bg-emerald-50/20 dark:bg-emerald-950/20' : ''
              }`}
            >
              <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0 mt-0.5">
                {getIcon(item.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                    item.actor === 'siti' 
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                  }`}>
                    {item.actorName.split(' ')[0]} ({item.actor === 'siti' ? 'HK' : 'Indramayu'})
                  </span>

                  <span className="text-[10px] text-neutral-400 font-mono">
                    {new Date(item.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mt-1 truncate">
                  {item.title}
                </h4>

                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5">
                  {item.description}
                </p>
              </div>

              {!item.isRead && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Link */}
      <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 border-t border-neutral-100 dark:border-neutral-800">
        <button
          onClick={() => {
            onClose();
            onViewAll();
          }}
          className="w-full py-1.5 px-3 rounded-xl bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <span>View all activity feed ({notifications.length})</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
