import React from "react";

interface CardProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "header";
  style?: React.CSSProperties;
}

const paddingMap = {
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export const Card: React.FC<CardProps> = ({ header, footer, padding = "md", children, className = "", variant = "default", style }) => {
  const isHeaderCard = variant === "header";
  const bgColor = isHeaderCard ? "bg-brand-blue" : "bg-white";
  const textColor = isHeaderCard ? "text-white" : "text-text-primary";
  const borderColor = isHeaderCard ? "border-brand-blue" : "border-border";

  return (
    <div className={`${bgColor} ${textColor} rounded-xl border ${borderColor} shadow-sm ${className}`} style={style}>
      {header && <div className={`${paddingMap[padding]} border-b ${borderColor} font-semibold`}>{header}</div>}
      <div className={paddingMap[padding]}>{children}</div>
      {footer && <div className={`${paddingMap[padding]} border-t ${borderColor}`}>{footer}</div>}
    </div>
  );
};

Card.displayName = "Card";
