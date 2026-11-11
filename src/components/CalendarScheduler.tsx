import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  ArrowRightLeft, 
  Home, 
  GraduationCap, 
  ShoppingBag, 
  PiggyBank, 
  CheckSquare, 
  Square, 
  Edit3, 
  Trash2, 
  Calendar as CalendarIcon, 
  AlertCircle,
  Filter,
  Sparkles
} from 'lucide-react';
import { AppData, CalendarEvent, EventType } from '../types';
import { Translations } from '../i18n/translations';
import { formatCurrencyIdr, formatMonthYear, formatDate } from '../utils/formatters';

interface CalendarSchedulerProps {
  data: AppData;
  t: Translations;
  onAddEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onOpenAddModalWithDate: (dateStr: string) => void;
}

export const CalendarScheduler: React.FC<CalendarSchedulerProps> = ({
  data,
  t,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
  onOpenAddModalWithDate
}) => {
  // Current calendar view month (defaults to November 2026 to match data)
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 10, 1)); // Nov 2026
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-11-02');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 10, 1));
    setSelectedDateStr('2026-11-02');
  };

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      const mStr = String(prevMonth).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({ day: d, dateStr: `${prevYear}-${mStr}-${dStr}`, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({ day: d, dateStr: `${year}-${mStr}-${dStr}`, isCurrentMonth: true });
    }

    // Next month padding to fill a 35 or 42 grid
    const remaining = 35 - days.length >= 0 ? 35 - days.length : 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      const mStr = String(nextMonth).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({ day: d, dateStr: `${nextYear}-${mStr}-${dStr}`, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    (data.calendarEvents || []).forEach(evt => {
      if (!map[evt.date]) {
        map[evt.date] = [];
      }
      map[evt.date].push(evt);
    });
    return map;
  }, [data.calendarEvents]);

  // Events on selected day
  const selectedDayEvents = useMemo(() => {
    return (eventsByDate[selectedDateStr] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [eventsByDate, selectedDateStr]);

  // All filtered events for to-do checklist
  const filteredEvents = useMemo(() => {
    return (data.calendarEvents || []).filter(evt => {
      if (filterType !== 'all' && evt.type !== filterType) return false;
      if (filterStatus === 'pending' && evt.isCompleted) return false;
      if (filterStatus === 'completed' && !evt.isCompleted) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.calendarEvents, filterType, filterStatus]);

  // Next scheduled remittance
  const nextRemittance = useMemo(() => {
    return (data.calendarEvents || [])
      .filter(e => e.type === 'remittance' && !e.isCompleted)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [data.calendarEvents]);

  // Total tasks stats
  const totalEvents = (data.calendarEvents || []).length;
  const completedEvents = (data.calendarEvents || []).filter(e => e.isCompleted).length;
  const completionPercent = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;

  const eventTypeIcons: Record<EventType, React.ReactNode> = {
    remittance: <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
    renovation: <Home className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
    tuition: <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
    allowance: <ShoppingBag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />,
    savings: <PiggyBank className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
    task: <CheckSquare className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
  };

  const eventTypeColors: Record<EventType, { bg: string; text: string; dot: string; border: string }> = {
    remittance: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      text: 'text-emerald-800 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      border: 'border-emerald-200 dark:border-emerald-800'
    },
    renovation: {
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      text: 'text-amber-800 dark:text-amber-300',
      dot: 'bg-amber-500',
      border: 'border-amber-200 dark:border-amber-800'
    },
    tuition: {
      bg: 'bg-blue-50 dark:bg-blue-950/60',
      text: 'text-blue-800 dark:text-blue-300',
      dot: 'bg-blue-500',
      border: 'border-blue-200 dark:border-blue-800'
    },
    allowance: {
      bg: 'bg-teal-50 dark:bg-teal-950/60',
      text: 'text-teal-800 dark:text-teal-300',
      dot: 'bg-teal-500',
      border: 'border-teal-200 dark:border-teal-800'
    },
    savings: {
      bg: 'bg-purple-50 dark:bg-purple-950/60',
      text: 'text-purple-800 dark:text-purple-300',
      dot: 'bg-purple-500',
      border: 'border-purple-200 dark:border-purple-800'
    },
    task: {
      bg: 'bg-neutral-100 dark:bg-neutral-800',
      text: 'text-neutral-800 dark:text-neutral-200',
      dot: 'bg-neutral-500',
      border: 'border-neutral-200 dark:border-neutral-700'
    }
  };

  const monthYearLabel = formatMonthYear(`${year}-${String(month + 1).padStart(2, '0')}`);

  return (
    <div className="space-y-6">
      {/* 1. Header & Scheduler Dashboard Strip */}
      <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Transfer Scheduler & Family Milestones
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
              Coordinate Siti's 15,000,000 IDR salary transfers from Hong Kong, renovation project deadlines, tuition due dates, and husband Slamet's on-site tasks in Indramayu.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAddModalWithDate(selectedDateStr)}
              className="hidden items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.actions.addEvent}</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Summary Bento Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs">
          {/* Next Transfer Countdown */}
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">Next Scheduled Transfer</span>
              <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            </div>
            {nextRemittance ? (
              <div>
                <div className="text-base font-bold font-mono text-emerald-950 dark:text-emerald-200">
                  {formatDate(nextRemittance.date)}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                  {nextRemittance.title} ({formatCurrencyIdr(nextRemittance.estimatedAmountIdr || 15000000)})
                </div>
              </div>
            ) : (
              <div className="text-xs text-emerald-700">All scheduled transfers completed</div>
            )}
          </div>

          {/* Task Completion Progress */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">Milestone Execution</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{completionPercent}%</span>
            </div>
            <div className="text-base font-bold font-mono text-neutral-900 dark:text-neutral-100">
              {completedEvents} of {totalEvents} Completed
            </div>
            <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>

          {/* Active Family Coordination */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700 space-y-1">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">Cross-Border Sync</span>
            <div className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Causeway Bay ➔ Indramayu
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Husband Slamet executes tasks upon receipt of funds.
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Bento Grid: Monthly Interactive Calendar (Left) + Day Spotlight & Checklist (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Monthly Calendar Grid */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-5">
          {/* Calendar Month Navigation Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {monthYearLabel}
              </h3>
              <button
                onClick={handleToday}
                className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-neutral-400 dark:text-neutral-500 py-1 border-b border-neutral-100 dark:border-neutral-800">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* 7x5 or 7x6 Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell) => {
              const events = eventsByDate[cell.dateStr] || [];
              const isSelected = cell.dateStr === selectedDateStr;
              const hasRemittance = events.some(e => e.type === 'remittance');
              const hasPending = events.some(e => !e.isCompleted);

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={`min-h-[76px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                      : cell.isCurrentMonth
                        ? 'border-neutral-200/70 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900'
                        : 'border-transparent text-neutral-300 dark:text-neutral-700 hover:border-neutral-200 dark:hover:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono font-medium ${
                      isSelected 
                        ? 'text-emerald-700 dark:text-emerald-300 font-bold' 
                        : cell.isCurrentMonth 
                          ? 'text-neutral-800 dark:text-neutral-200' 
                          : 'text-neutral-400'
                    }`}>
                      {cell.day}
                    </span>

                    {events.length > 0 && (
                      <span className="text-[10px] font-mono text-neutral-400">
                        {events.length}
                      </span>
                    )}
                  </div>

                  {/* Badges / Dots on Calendar Cell */}
                  <div className="space-y-1 my-0.5">
                    {events.slice(0, 2).map((evt) => {
                      const colors = eventTypeColors[evt.type] || eventTypeColors.task;
                      return (
                        <div
                          key={evt.id}
                          className={`text-[9px] px-1 py-0.5 rounded truncate font-medium flex items-center gap-1 ${
                            evt.isCompleted ? 'line-through opacity-60 bg-neutral-100 dark:bg-neutral-800 text-neutral-500' : `${colors.bg} ${colors.text}`
                          }`}
                          title={`${evt.time ? evt.time + ' · ' : ''}${evt.title}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} shrink-0`} />
                          <span className="truncate">{evt.title}</span>
                        </div>
                      );
                    })}

                    {events.length > 2 && (
                      <div className="text-[9px] text-neutral-400 font-mono text-center">
                        +{events.length - 2} more
                      </div>
                    )}
                  </div>

                  {/* Add action on cell hover */}
                  <div className="text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAddModalWithDate(cell.dateStr);
                      }}
                      className="hidden text-[10px] text-neutral-400 hover:text-emerald-600 transition-opacity"
                      title="Add task on this date"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Color Legend */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Remittance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Renovation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>School Tuition</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <span>Allowance & Food</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Bank Savings</span>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Day Spotlight & To-Do Checklist */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selected Date Spotlight Tile */}
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
                  Selected Date
                </span>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {formatDate(selectedDateStr)}
                </h3>
              </div>

              <button
                onClick={() => onOpenAddModalWithDate(selectedDateStr)}
                className="hidden items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="py-8 text-center space-y-2 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                <CalendarIcon className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto" />
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  No scheduled items for this date.
                </div>
                <button
                  onClick={() => onOpenAddModalWithDate(selectedDateStr)}
                  className="hidden text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                >
                  Schedule a transfer or add a to-do
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((evt) => {
                  const colors = eventTypeColors[evt.type] || eventTypeColors.task;

                  return (
                    <div
                      key={evt.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        evt.isCompleted 
                          ? 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 opacity-75' 
                          : `${colors.bg} ${colors.border}`
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Interactive Checkbox */}
                        <button
                          onClick={() => onToggleComplete(evt.id)}
                          className="mt-0.5 text-neutral-400 hover:text-emerald-600 transition-colors shrink-0"
                          title={evt.isCompleted ? 'Mark as pending' : 'Mark as completed'}
                        >
                          {evt.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-neutral-400" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={`text-xs font-bold ${evt.isCompleted ? 'line-through text-neutral-500' : 'text-neutral-900 dark:text-neutral-100'}`}>
                              {evt.title}
                            </h4>
                          </div>

                          {evt.notes && (
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                              {evt.notes}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-neutral-500">
                            {evt.time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {evt.time}
                              </span>
                            )}
                            {evt.assignedTo && (
                              <span>· Assigned: <strong>{evt.assignedTo}</strong></span>
                            )}
                            {evt.estimatedAmountIdr && (
                              <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                                · {formatCurrencyIdr(evt.estimatedAmountIdr)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onEditEvent(evt)}
                            className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteEvent(evt.id)}
                            className="p-1 rounded text-neutral-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Full Family To-Do & Schedule List */}
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Family Milestone Checklist
                </h3>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px]">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-2 py-1 rounded transition-colors ${filterStatus === 'all' ? 'bg-white dark:bg-neutral-700 font-semibold shadow-2xs' : 'text-neutral-500'}`}
                >
                  All ({data.calendarEvents.length})
                </button>
                <button
                  onClick={() => setFilterStatus('pending')}
                  className={`px-2 py-1 rounded transition-colors ${filterStatus === 'pending' ? 'bg-white dark:bg-neutral-700 font-semibold shadow-2xs' : 'text-neutral-500'}`}
                >
                  Pending ({data.calendarEvents.filter(e => !e.isCompleted).length})
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`px-2 py-1 rounded transition-colors ${filterStatus === 'completed' ? 'bg-white dark:bg-neutral-700 font-semibold shadow-2xs' : 'text-neutral-500'}`}
                >
                  Done ({completedEvents})
                </button>
              </div>
            </div>

            {/* Checklist items */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-h-96 overflow-y-auto pr-1 space-y-1">
              {filteredEvents.map((evt) => (
                <div key={evt.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <button
                    onClick={() => onToggleComplete(evt.id)}
                    className="mt-0.5 text-neutral-400 hover:text-emerald-600 transition-colors shrink-0"
                  >
                    {evt.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold truncate ${evt.isCompleted ? 'line-through text-neutral-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                        {evt.title}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                        {formatDate(evt.date)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                      <span className="capitalize">{evt.type}</span>
                      {evt.assignedTo && <span>· {evt.assignedTo}</span>}
                      {evt.estimatedAmountIdr && (
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                          · {formatCurrencyIdr(evt.estimatedAmountIdr)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onEditEvent(evt)}
                      className="p-1 text-neutral-400 hover:text-neutral-700"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteEvent(evt.id)}
                      className="p-1 text-neutral-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
