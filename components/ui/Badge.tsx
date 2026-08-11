import React from "react";

interface BadgeProps {
  variant?: "default" | "blue" | "green" | "amber" | "red" | "purple" | "teal";
  children: React.ReactNode;
  className?: string;
}

const variantClasses = {
  default: "bg-ops-card2 text-text-primary",
  blue: "bg-brand-blue text-white",
  green: "bg-success text-white",
  amber: "bg-alert-amber text-white",
  red: "bg-danger text-white",
  purple: "bg-purple-600 text-white",
  teal: "bg-teal-600 text-white",
};

export const Badge: React.FC<BadgeProps> = ({ variant = "default", children, className = "" }) => {
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

Badge.displayName = "Badge";
