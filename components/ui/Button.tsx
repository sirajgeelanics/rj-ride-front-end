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
    const baseClasses = "font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

    const variantClasses = {
      primary: "bg-brand-blue text-white hover:bg-[#962C4A] shadow-sm hover:shadow",
      secondary: "border border-border text-text-primary hover:bg-ops-card2",
      // The ghost hover is a warm panel tint (ops-card2 = #F1EEE9, the FL8 "muted" tone). The
      // table Actions columns (configuration + pricing tabs) override it with explicit IMPORTANT
      // hovers — hover:bg-brand-wine/10! / hover:bg-danger/10! — because this utility sorts AFTER
      // them in the emitted CSS and would otherwise win the cascade. The trailing `!` is
      // Tailwind v4 important syntax; don't strip it when restyling these buttons.
      ghost: "text-text-primary hover:bg-ops-card2",
      danger: "bg-danger text-white hover:bg-[#A3371F]",
    };

    const sizeClasses = {
      sm: "px-2 py-1 text-xs",
      md: "px-3 py-2 text-sm",
      lg: "px-4 py-3 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {props.children}
      </button>
    );
  }
);

Button.displayName = "Button";
