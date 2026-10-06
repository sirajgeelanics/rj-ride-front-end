import React, { useId } from "react";
import { Eye, EyeOff, LucideIcon } from "lucide-react";

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
  ({ label, error, startIcon: StartIcon, endIcon: EndIcon, className = "", id, type, ...props }, ref) => {
    const fallbackId = useId();
    const [revealed, setRevealed] = React.useState(false);
    const isPassword = type === "password";
    const effectiveType = isPassword && revealed ? "text" : type;
    const safeSuffix = fallbackId.replace(/[^a-zA-Z0-9_-]/g, "");
    const inputId = id || (label ? `${slugify(label)}-${safeSuffix}` : fallbackId);

    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="block text-xs font-semibold mb-1.5 text-text-primary">{label}</label>}
        <div className="relative flex items-center">
          {StartIcon && <StartIcon className="absolute left-3 w-4 h-4 text-text-secondary" />}
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            className={`w-full h-10 px-3 text-sm ${StartIcon ? "pl-10" : ""} ${EndIcon || isPassword ? "pr-10" : ""} bg-white border border-border rounded-lg text-text-primary placeholder:text-text-tertiary shadow-[inset_0_1px_1px_rgba(7,45,98,0.03)] transition-[border-color,box-shadow] hover:border-[#C2C7CF] focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue disabled:bg-ops-card2 disabled:text-text-tertiary disabled:cursor-not-allowed ${error ? "border-danger focus:border-danger focus:ring-danger/20" : ""} ${className}`}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              className="absolute right-2 p-1 rounded-md text-text-secondary hover:text-text-primary transition-colors"
            >
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          ) : (
            EndIcon && <EndIcon className="absolute right-3 w-4 h-4 text-text-secondary" />
          )}
        </div>
        {error && <p className="text-xs text-danger mt-1.5" role="alert">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
