import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading = false, className = "", disabled, ...props }, ref) => {
    const baseClasses = "font-medium rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center justify-center gap-2 whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

    const variantClasses = {
      primary: "bg-gradient-to-b from-[#0E3F82] to-brand-blue text-white shadow-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] hover:brightness-110 hover:shadow-lift hover:-translate-y-px",
      secondary: "bg-white border border-border text-text-primary shadow-soft hover:bg-ops-card2 hover:border-[#C9CDD4]",
      // The ghost hover is a warm panel tint (ops-card2 = #F1EEE9, the FL8 "muted" tone). The
      // table Actions columns (configuration + pricing tabs) override it with explicit IMPORTANT
      // hovers — hover:bg-brand-wine/10! / hover:bg-danger/10! — because this utility sorts AFTER
      // them in the emitted CSS and would otherwise win the cascade. The trailing `!` is
      // Tailwind v4 important syntax; don't strip it when restyling these buttons.
      ghost: "text-text-primary hover:bg-ops-card2",
      danger: "bg-gradient-to-b from-[#D14E34] to-danger text-white shadow-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] hover:brightness-110 hover:shadow-lift focus-visible:ring-danger/40",
    };

    const sizeClasses = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {props.children}
      </button>
    );
  }
);

Button.displayName = "Button";
