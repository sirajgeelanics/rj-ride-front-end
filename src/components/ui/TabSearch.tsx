import React from "react";
import { Search, X } from "lucide-react";

interface TabSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Shown to screen readers and as the tooltip. */
  label: string;
  /** "12 of 55" style result note shown under the box while searching. */
  resultNote?: string;
  className?: string;
}

/** A compact search box for one list, with a clear button and an optional result count. */
export const TabSearch: React.FC<TabSearchProps> = ({
  value,
  onChange,
  placeholder,
  label,
  resultNote,
  className = "w-72",
}) => (
  <div className={className}>
    <div className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        title={label}
        className="w-full h-10 pl-9 pr-9 bg-white border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary hover:border-[#C2C7CF] transition-[border-color,box-shadow] focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-ops-bg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
    {value && resultNote && <p className="mt-1 text-xs text-text-secondary">{resultNote}</p>}
  </div>
);
