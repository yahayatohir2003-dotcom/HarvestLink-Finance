import React from "react";
import { getVerificationStatusConfig } from "@/lib/document-utils";
import { DocumentVerificationStatus } from "@/types/document";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

interface DocumentStatusBadgeProps {
  status: DocumentVerificationStatus | string;
  size?: "sm" | "md";
}

/**
 * Visual badge displaying document verification state.
 */
export function DocumentStatusBadge({ status, size = "md" }: DocumentStatusBadgeProps) {
  const config = getVerificationStatusConfig(status);

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  const renderIcon = () => {
    switch (config.iconName) {
      case "CheckCircle2":
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "XCircle":
        return <XCircle className="h-3.5 w-3.5" />;
      case "Clock":
      default:
        return <Clock className="h-3.5 w-3.5" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses}`}
    >
      {renderIcon()}
      {config.label}
    </span>
  );
}
