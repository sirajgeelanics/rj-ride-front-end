import React from "react";
import { APP_VERSION_LABEL, APP_VERSION_TITLE } from "@/lib/appVersion";

/** The portal's build version, shown on every screen (next to the profile menu, and on the sign-in page). */
export const AppVersion: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span title={APP_VERSION_TITLE} className={`select-text ${className}`}>
    {APP_VERSION_LABEL}
  </span>
);
