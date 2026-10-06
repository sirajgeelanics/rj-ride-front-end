import React from "react";

interface BadgeProps {
  variant?: "default" | "blue" | "green" | "amber" | "red" | "purple" | "teal";
  children: React.ReactNode;
  className?: string;
}

// Soft tinted pills: pale fill, deep text (>= AA on the tint), matching leading dot.
const variantClasses = {
  default: "bg-ops-card2 text-text-secondary ring-[#DCDFE4]",
  blue: "bg-navy-soft text-brand-blue ring-brand-blue/15",
  green: "bg-success-soft text-[#17623A] ring-success/20",
  amber: "bg-amber-soft text-[#8A5A14] ring-alert-amber/30",
  red: "bg-danger-soft text-[#A3341F] ring-danger/20",
  purple: "bg-[#F0EAF8] text-[#5B2E91] ring-[#7C4DBA]/20",
  teal: "bg-[#E2F3F2] text-[#0F6B67] ring-[#14908B]/20",
};

const dotClasses = {
  default: "bg-text-tertiary",
  blue: "bg-brand-blue",
  green: "bg-success",
  amber: "bg-alert-amber",
  red: "bg-danger",
  purple: "bg-[#7C4DBA]",
  teal: "bg-[#14908B]",
};

export const Badge: React.FC<BadgeProps> = ({ variant = "default", children, className = "" }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${variantClasses[variant]} ${className}`}
    >
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses[variant]}`} />
      {children}
    </span>
  );
};

Badge.displayName = "Badge";
