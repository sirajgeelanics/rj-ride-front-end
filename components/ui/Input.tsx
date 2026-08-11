import React, { useId } from "react";
import { LucideIcon } from "lucide-react";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  startIcon?: LucideIcon;
  endIcon?: LucideIcon;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, startIcon: StartIcon, endIcon: EndIcon, className = "", id, ...props }, ref) => {
    const fallbackId = useId();
    const safeSuffix = fallbackId.replace(/[^a-zA-Z0-9_-]/g, "");
    const inputId = id || (label ? `${slugify(label)}-${safeSuffix}` : fallbackId);

    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="block text-sm font-medium mb-1 text-text-primary">{label}</label>}
        <div className="relative flex items-center">
          {StartIcon && <StartIcon className="absolute left-3 w-4 h-4 text-text-secondary" />}
          <input
            ref={ref}
            id={inputId}
            className={`w-full px-3 py-2 ${StartIcon ? "pl-10" : ""} ${EndIcon ? "pr-10" : ""} bg-white border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent ${className}`}
            {...props}
          />
          {EndIcon && <EndIcon className="absolute right-3 w-4 h-4 text-text-secondary" />}
        </div>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
