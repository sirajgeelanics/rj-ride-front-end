import React, { useId } from "react";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  /** Text for the auto-inserted placeholder shown when `value` matches no option. */
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", id, placeholder = "Select…", ...props }, ref) => {
    const fallbackId = useId();
    const safeSuffix = fallbackId.replace(/[^a-zA-Z0-9_-]/g, "");
    const selectId = id || (label ? `${slugify(label)}-${safeSuffix}` : fallbackId);

    // A native <select> whose value matches no option still *renders* the first one, while the
    // caller's state stays "". The form then looks filled in but fails validation ("please select
    // a customer") with nothing visibly wrong. Insert a placeholder so the displayed option always
    // reflects the actual value, and picking a real one is an explicit act that fires onChange.
    const needsPlaceholder =
      props.value !== undefined && !options.some((o) => o.value === props.value);
    // A filter that has been set reads as set: tinted navy, so active filters are visible at a glance.
    const isSet = props.value !== undefined && props.value !== "";

    return (
      <div className="w-full">
        {label && <label htmlFor={selectId} className="block text-xs font-semibold mb-1.5 text-text-primary">{label}</label>}
        <select
          ref={ref}
          id={selectId}
          className={`w-full h-10 pl-3 pr-9 text-sm appearance-none cursor-pointer bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat bg-[url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23072D62' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>")] border rounded-lg transition-[border-color,box-shadow,background-color] focus:outline-none ${isSet ? "bg-navy-soft border-brand-blue/50 text-brand-blue font-medium hover:border-brand-blue" : "bg-white border-border text-text-primary hover:border-[#C2C7CF]"} focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue disabled:bg-ops-card2 disabled:text-text-tertiary disabled:cursor-not-allowed ${error ? "border-danger focus:border-danger focus:ring-danger/20" : ""} ${className}`}
          {...props}
        >
          {needsPlaceholder && (
            <option value={props.value as string} disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger mt-1.5" role="alert">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
