"use client";

import React, { useMemo, useState } from "react";
import { Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { CalendarDialog } from "@/components/ui/CalendarDialog";
import { TimeDialog } from "@/components/ui/TimeDialog";

export type PickerMode = "date" | "datetime" | "time";

interface DateTimePickerProps {
  /**
   * "YYYY-MM-DD" (date) · "YYYY-MM-DDTHH:mm" (datetime) · "HH:mm" (time).
   * Empty/undefined = unset — undefined is accepted so callers holding optional state
   * (e.g. `.split("T")[0]`) don't each need their own `?? ""`.
   */
  value: string | undefined;
  onChange: (value: string) => void;
  mode?: PickerMode;
  placeholder?: string;
  /** Earliest selectable day, "YYYY-MM-DD". */
  minDate?: string;
  /**
   * Reject dates/times in the past. Disables earlier calendar days (min = today) and, for
   * `datetime`/`date` mode, snaps a chosen moment that lands before "now" forward to now — so a
   * trip can never be scheduled in the past, even for a time earlier today. Ignored for `time` mode
   * (a recurring time-of-day has no past/future). An explicit `minDate` still wins for the day floor.
   */
  disablePast?: boolean;
  className?: string;
  disabled?: boolean;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Parse the stored string WITHOUT Date's UTC parsing — `new Date("2026-08-05")` is midnight UTC
 * and lands on the previous day in a negative offset, which would silently shift every date.
 */
function parseValue(value: string, mode: PickerMode) {
  const empty = { y: 0, m: 0, d: 0, hh: 0, mm: 0, hasDate: false, hasTime: false };
  if (!value) return empty;

  if (mode === "time") {
    const [h, mi] = value.split(":");
    if (h === undefined || mi === undefined) return empty;
    return { ...empty, hh: Number(h), mm: Number(mi), hasTime: true };
  }

  const [datePart, timePart] = value.split("T");
  const [y, m, d] = (datePart ?? "").split("-").map(Number);
  if (!y || !m || !d) return empty;
  let hh = 0;
  let mm = 0;
  let hasTime = false;
  if (timePart) {
    const [h, mi] = timePart.split(":");
    hh = Number(h ?? 0);
    mm = Number(mi ?? 0);
    hasTime = true;
  }
  return { y, m, d, hh, mm, hasDate: true, hasTime };
}

function format(y: number, m: number, d: number, hh: number, mm: number, mode: PickerMode): string {
  if (mode === "time") return `${pad(hh)}:${pad(mm)}`;
  const date = `${y}-${pad(m)}-${pad(d)}`;
  return mode === "datetime" ? `${date}T${pad(hh)}:${pad(mm)}` : date;
}

/** Text on the closed field, e.g. "05 Aug 2026, 02:30 PM". */
function displayValue(value: string, mode: PickerMode): string {
  const p = parseValue(value, mode);
  const clock = (hh: number, mm: number) => {
    const ampm = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${pad(h12)}:${pad(mm)} ${ampm}`;
  };
  if (mode === "time") return p.hasTime ? clock(p.hh, p.mm) : "";
  if (!p.hasDate) return "";
  const label = `${pad(p.d)} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
  return mode === "datetime" ? `${label}, ${clock(p.hh, p.mm)}` : label;
}

/**
 * Date / date-time / time field. Clicking it opens a centered Material-style dialog: a calendar
 * for dates, an analog clock dial for times, and both in sequence for datetime. Replaces the
 * browser's native picker, which looks different in every browser and ignores the app's styling.
 *
 * Emits the same string shapes the native inputs did, so callers only swap the element.
 */
export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  mode = "date",
  placeholder,
  minDate,
  disablePast = false,
  className = "",
  disabled = false,
}) => {
  // For `datetime` the two dialogs run in sequence: calendar → clock.
  const [step, setStep] = useState<"none" | "calendar" | "clock">("none");
  const [draftDate, setDraftDate] = useState<Date | null>(null);

  const parts = useMemo(() => parseValue(value ?? "", mode), [value, mode]);

  const initialDate = useMemo(
    () => (parts.hasDate ? new Date(parts.y, parts.m - 1, parts.d) : new Date()),
    [parts],
  );
  const min = useMemo(() => {
    if (minDate) {
      const p = parseValue(minDate, "date");
      if (p.hasDate) return new Date(p.y, p.m - 1, p.d);
    }
    // No explicit floor but past disallowed → earliest selectable day is today.
    if (disablePast) {
      const t = new Date();
      return new Date(t.getFullYear(), t.getMonth(), t.getDate());
    }
    return undefined;
  }, [minDate, disablePast]);

  /**
   * Emit the chosen value, but when `disablePast` is on never let a datetime land before now:
   * a same-day time earlier than the current time is snapped up to now (seconds cleared). The
   * calendar already blocks earlier days, so this only bites the "today, but an earlier hour" case.
   */
  const commit = (val: string) => {
    if (disablePast && val && mode !== "time") {
      const p = parseValue(val, mode);
      if (p.hasDate) {
        const chosen = new Date(p.y, p.m - 1, p.d, p.hh, p.mm).getTime();
        const now = Date.now();
        if (chosen < now) {
          const snapped = new Date(now);
          snapped.setSeconds(0, 0);
          val = format(
            snapped.getFullYear(),
            snapped.getMonth() + 1,
            snapped.getDate(),
            mode === "datetime" ? snapped.getHours() : 0,
            mode === "datetime" ? snapped.getMinutes() : 0,
            mode,
          );
        }
      }
    }
    onChange(val);
  };

  const open = () => {
    if (disabled) return;
    setDraftDate(null);
    setStep(mode === "time" ? "clock" : "calendar");
  };

  const onDatePicked = (d: Date) => {
    if (mode === "datetime") {
      setDraftDate(d);
      setStep("clock"); // continue to the time step
      return;
    }
    commit(format(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0, mode));
    setStep("none");
  };

  const onTimePicked = (hh: number, mm: number) => {
    if (mode === "time") {
      commit(format(0, 0, 0, hh, mm, mode));
    } else {
      const d = draftDate ?? initialDate;
      commit(format(d.getFullYear(), d.getMonth() + 1, d.getDate(), hh, mm, mode));
    }
    setStep("none");
  };

  const text = displayValue(value ?? "", mode);
  const Icon = mode === "time" ? Clock : CalendarIcon;
  const fallback =
    placeholder ??
    (mode === "time" ? "Select time" : mode === "datetime" ? "Select date & time" : "Select date");

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={open}
        className={`w-full flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
          text ? "text-text-primary" : "text-text-tertiary"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0 text-text-secondary" />
        <span className="flex-1 truncate">{text || fallback}</span>
        {text && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="shrink-0 text-text-tertiary hover:text-danger"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {step === "calendar" && (
        <CalendarDialog
          initialDate={initialDate}
          minDate={min}
          onConfirm={onDatePicked}
          onClose={() => setStep("none")}
          title={mode === "datetime" ? "SELECT DATE" : "SELECT DATE"}
          confirmLabel={mode === "datetime" ? "NEXT" : "OK"}
        />
      )}

      {step === "clock" && (
        <TimeDialog
          initialHour={parts.hasTime || mode === "time" ? parts.hh : 9}
          initialMinute={parts.hasTime || mode === "time" ? parts.mm : 0}
          onConfirm={onTimePicked}
          onClose={() => setStep("none")}
        />
      )}
    </div>
  );
};

DateTimePicker.displayName = "DateTimePicker";
