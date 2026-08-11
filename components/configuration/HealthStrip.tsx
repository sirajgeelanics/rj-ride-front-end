import React from "react";
import { AlertCircle } from "lucide-react";

interface HealthStripProps {
  expiredCount: number;
  expiringCount: number;
}

export const HealthStrip: React.FC<HealthStripProps> = ({ expiredCount, expiringCount }) => {
  if (expiredCount === 0 && expiringCount === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-900/20 border border-yellow-700/40 rounded p-3 flex items-center gap-2 text-sm">
      <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
      <span className="text-yellow-700">
        {expiredCount > 0 && <span className="font-semibold">{expiredCount} expired</span>}
        {expiredCount > 0 && expiringCount > 0 && <span> • </span>}
        {expiringCount > 0 && <span className="font-semibold">{expiringCount} expiring soon</span>}
      </span>
    </div>
  );
};

HealthStrip.displayName = "HealthStrip";
