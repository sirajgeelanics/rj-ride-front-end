import React from "react";
import { Link } from "@/lib/router";

const TONES = {
  navy: "bg-navy-soft text-brand-blue ring-brand-blue/20 hover:bg-brand-blue hover:text-white",
  gold: "bg-gold-soft text-[#7A5C1E] ring-accent-gold/40 hover:bg-accent-gold hover:text-white",
  green: "bg-success-soft text-[#17623A] ring-success/25 hover:bg-success hover:text-white",
} as const;

/** A small pill-shaped link used for per-row actions (Fleet, Trips, Details). */
export function ActionLink({
  href,
  tone = "navy",
  children,
}: {
  href: string;
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center h-7 px-2.5 rounded-full text-xs font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 ${TONES[tone]}`}
    >
      {children}
    </Link>
  );
}

export function ActionButton({
  onClick,
  tone = "navy",
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center h-7 px-2.5 rounded-full text-xs font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 ${TONES[tone]}`}
    >
      {children}
    </button>
  );
}
