"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarDialogProps {
  initialDate: Date;
  minDate?: Date;
  maxDate?: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
  /** Shown in the header banner, e.g. "SELECT DATE" / "SELECT PICKUP DATE". */
  title?: string;
  /** Label for the confirm button — "NEXT" when a time step follows. */
  confirmLabel?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Centered Material-style calendar dialog: header banner, circular days, CANCEL / OK. */
export const CalendarDialog: React.FC<CalendarDialogProps> = ({
  initialDate,
  minDate,
  maxDate,
  onConfirm,
  onClose,
  title = "SELECT DATE",
  confirmLabel = "OK",
}) => {
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selected, setSelected] = useState<Date>(startOfDay(initialDate));

  const today = startOfDay(new Date());
  const minD = minDate ? startOfDay(minDate) : null;
  const maxD = maxDate ? startOfDay(maxDate) : null;

  const isDisabled = (d: Date) => (!!minD && d < minD) || (!!maxD && d > maxD);

  const shiftMonth = (delta: number) => {
    const dt = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(dt.getFullYear());
    setViewMonth(dt.getMonth());
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = new Date(viewYear, viewMonth, 1).getDay();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#072D62]/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="bg-white rounded-2xl shadow-xl w-[340px] overflow-hidden">
        {/* Header banner — the currently selected date, Material style */}
        <div className="bg-brand-blue px-6 py-5">
          <p className="text-white/70 text-[11px] font-semibold tracking-wide mb-1">{title}</p>
          <p className="text-white text-2xl font-bold">
            {selected.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-semibold text-brand-blue">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4 text-brand-blue" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4 text-brand-blue" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] text-gray-400 font-semibold py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((d, i) =>
              !d ? (
                <div key={`empty-${i}`} />
              ) : (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={isDisabled(d)}
                  onClick={() => setSelected(d)}
                  className={`w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isSameDay(d, selected)
                      ? "bg-brand-blue text-white font-bold"
                      : isDisabled(d)
                        ? "text-gray-300 cursor-not-allowed"
                        : isSameDay(d, today)
                          ? "border border-brand-blue text-brand-blue hover:bg-brand-blue/10"
                          : "text-gray-700 hover:bg-brand-blue/10"
                  }`}
                >
                  {d.getDate()}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 px-3 pb-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="px-4 py-2 text-sm font-bold text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

CalendarDialog.displayName = "CalendarDialog";
