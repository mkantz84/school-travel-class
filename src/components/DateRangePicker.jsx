import React, { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, isValid } from 'date-fns';
import { he } from 'date-fns/locale';
import { Calendar, X, ChevronDown } from 'lucide-react';
import 'react-day-picker/dist/style.css';

function toDate(str) {
  if (!str) return undefined;
  const d = parseISO(str);
  return isValid(d) ? d : undefined;
}

function toIso(date) {
  if (!date || !isValid(date)) return '';
  return format(date, 'yyyy-MM-dd');
}

export function formatHebrewRange(startStr, endStr) {
  const from = toDate(startStr);
  const to = toDate(endStr);
  if (!from) return '';
  if (!to || startStr === endStr) {
    return format(from, 'd בMMMM yyyy', { locale: he });
  }
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${format(from, 'd', { locale: he })}–${format(to, 'd בMMMM yyyy', { locale: he })}`;
  }
  return `${format(from, 'd בMMM', { locale: he })} – ${format(to, 'd בMMM yyyy', { locale: he })}`;
}

export default function DateRangePicker({ startDate, endDate, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = {
    from: toDate(startDate),
    to: toDate(endDate),
  };

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSelect = (range) => {
    if (!range) {
      onChange({ start_date: '', end_date: '' });
      return;
    }
    const start_date = toIso(range.from);
    const end_date = toIso(range.to || range.from);
    onChange({ start_date, end_date });
  };

  const label = formatHebrewRange(startDate, endDate);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/20 transition text-right"
      >
        <span className="flex items-center gap-2.5 text-sm">
          <Calendar className="w-4 h-4 text-forest-600 shrink-0" />
          {label ? (
            <span className="font-medium text-slate-800">{label}</span>
          ) : (
            <span className="text-slate-400">בחירת תאריכי הטיול (יום אחד או טווח)...</span>
          )}
        </span>
        <span className="flex items-center gap-1">
          {label && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ start_date: '', end_date: '' });
              }}
              className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              title="ניקוי תאריכים"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-40 mt-2 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 animate-in fade-in zoom-in-95 duration-150">
          <DayPicker
            mode="range"
            locale={he}
            dir="rtl"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected.from || new Date()}
          />
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>לחצו על תאריך התחלה ותאריך סיום</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded-lg bg-forest-500 text-white font-medium hover:bg-forest-600"
            >
              אישור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
