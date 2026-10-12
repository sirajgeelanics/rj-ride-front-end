import React from "react";

interface SectionProps {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** A titled white card — the console's standard container for a table or a group of numbers. */
export function Section({ title, hint, action, children }: SectionProps) {
  return (
    <section className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-ops-line">
        <div>
          <h3 className="font-serif text-xl font-medium text-text-primary">{title}</h3>
          {hint && <p className="text-xs text-text-secondary mt-0.5">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-8 text-center text-sm text-text-secondary">
        {text}
      </td>
    </tr>
  );
}

export const th = "px-3 py-3 font-semibold";
export const thHead = "text-left text-[11px] uppercase tracking-wider text-text-tertiary bg-ops-bg/60";
export const row = "border-t border-ops-line hover:bg-ops-bg/60 transition-colors";
