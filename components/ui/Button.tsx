"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-[linear-gradient(180deg,#0E3F82_0%,#072D62_100%)] shadow-[var(--shadow-soft),inset_0_1px_0_rgba(255,255,255,0.16)] hover:brightness-110 hover:-translate-y-px hover:shadow-[var(--shadow-lift),inset_0_1px_0_rgba(255,255,255,0.2)] focus-visible:ring-brand-blue",
  secondary:
    "text-text-primary bg-white border border-border shadow-[var(--shadow-soft)] hover:bg-page-bg hover:border-[#c3c8d0] focus-visible:ring-brand-blue",
  ghost: "text-text-secondary hover:bg-table-header hover:text-text-primary focus-visible:ring-brand-blue",
  danger:
    "text-white bg-[linear-gradient(180deg,#D4573F_0%,#C4432B_100%)] shadow-[var(--shadow-soft),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-105 hover:-translate-y-px focus-visible:ring-danger",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className = "", children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:brightness-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
