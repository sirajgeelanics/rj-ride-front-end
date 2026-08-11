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

    return (
      <div className="w-full">
        {label && <label htmlFor={selectId} className="block text-sm font-medium mb-1 text-text-primary">{label}</label>}
        <select
          ref={ref}
          id={selectId}
          className={`w-full px-3 py-2 bg-white border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent ${className}`}
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
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
