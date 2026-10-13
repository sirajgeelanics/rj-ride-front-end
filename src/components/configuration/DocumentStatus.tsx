import React from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { getDocumentStatus } from "@/lib/validation";

interface DocumentStatusProps {
  expiryDate: string | undefined;
}

export const DocumentStatus: React.FC<DocumentStatusProps> = ({ expiryDate }) => {
  const status = getDocumentStatus(expiryDate);

  if (status === "valid") {
    return (
      <div className="flex items-center gap-1 text-green-400 text-xs">
        <CheckCircle className="w-3 h-3" />
        Valid
      </div>
    );
  }

  if (status === "expiring") {
    return (
      <div className="flex items-center gap-1 text-amber-400 text-xs">
        <AlertCircle className="w-3 h-3" />
        Expiring
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-red-400 text-xs">
      <AlertCircle className="w-3 h-3" />
      Expired
    </div>
  );
};

DocumentStatus.displayName = "DocumentStatus";
