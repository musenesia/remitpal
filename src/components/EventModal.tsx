import React, { useState } from 'react';
import { X, Calendar, Clock, DollarSign, User, AlertCircle } from 'lucide-react';
import { CalendarEvent, EventType } from '../types';
import { Translations } from '../i18n/translations';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  editingEvent?: CalendarEvent | null;
  defaultDate?: string;
  husbandName: string;
  workerName: string;
  t: Translations;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingEvent,
  defaultDate,
  husbandName,
  workerName,
  t
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState(editingEvent?.title || '');
  const [date, setDate] = useState(editingEvent?.date || defaultDate || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(editingEvent?.time || '10:00');
  const [type, setType] = useState<EventType>(editingEvent?.type || 'remittance');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(editingEvent?.priority || 'medium');
  const [assignedTo, setAssignedTo] = useState(editingEvent?.assignedTo || `${husbandName} (Indramayu)`);
  const [estimatedAmountIdr, setEstimatedAmountIdr] = useState<number | undefined>(editingEvent?.estimatedAmountIdr || (type === 'remittance' ? 15000000 : undefined));
  const [notes, setNotes] = useState(editingEvent?.notes || '');
  const [isCompleted, setIsCompleted] = useState(editingEvent?.isCompleted || false);

  const handleTypeChange = (newType: EventType) => {
    setType(newType);
    if (newType === 'remittance' && !estimatedAmountIdr) {
      setEstimatedAmountIdr(15000000);
      setAssignedTo(`${workerName} (HK)`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const eventItem: CalendarEvent = {
      id: editingEvent?.id || `evt-${Date.now()}`,
      title,
      date,
      time: time || undefined,
      type,
      priority,
      isCompleted,
      assignedTo: assignedTo || undefined,
      estimatedAmountIdr: estimatedAmountIdr ? Number(estimatedAmountIdr) : undefined,
      notes: notes || undefined
    };

    onSave(eventItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg my-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {editingEvent ? t.actions.editEvent : t.actions.addEvent}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Event / Task Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Remittance 15M IDR or Pay Mason Wage"
              className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Type & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Category / Schedule Type
              </label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as EventType)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="remittance">Remittance Transfer (15M Target)</option>
                <option value="renovation">Home Renovation Milestone</option>
                <option value="tuition">School Tuition & Education</option>
                <option value="allowance">Monthly Allowance & Sembako</option>
                <option value="savings">Bank Savings Deposit</option>
                <option value="task">General Family Task / Video Call</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Scheduled Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Time (Optional)
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Estimated Amount (IDR) & Assigned Person */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Estimated Amount (IDR, Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono">Rp</span>
                <input
                  type="number"
                  step="50000"
                  min="0"
                  value={estimatedAmountIdr || ''}
                  onChange={(e) => setEstimatedAmountIdr(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="e.g. 15000000"
                  className="w-full pl-9 pr-3 py-2 font-mono rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Assigned To
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value={`${workerName} (HK)`}>{workerName} (Hong Kong)</option>
                <option value={`${husbandName} (Indramayu)`}>{husbandName} (Indramayu)</option>
                <option value="Both Siti & Slamet">Both Siti & Slamet</option>
                <option value="Pak Karyo (Head Mason)">Pak Karyo (Head Mason)</option>
                <option value="School Administration">School Administration</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Instructions / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please send the bank deposit slip photo after completing..."
              className="w-full p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs"
            />
          </div>

          {/* Completion Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="event-is-completed"
              checked={isCompleted}
              onChange={(e) => setIsCompleted(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="event-is-completed" className="text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
              Mark as already completed
            </label>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 transition-colors"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs"
            >
              {t.actions.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
