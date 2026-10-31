import React from "react";
import { getStatusBadgeConfig } from "@/lib/po-utils";
import { PurchaseOrderStatus } from "@/types/purchase-order";
import { CheckCircle2, Clock, AlertCircle, XCircle, FileText, CheckCheck } from "lucide-react";

interface StatusBadgeProps {
  status: PurchaseOrderStatus | string;
  size?: "sm" | "md" | "lg";
}

/**
 * Visual badge displaying the current state of a Purchase Order
 * with appropriate Nigerian agricultural fintech color accents.
 */
export function PoStatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = getStatusBadgeConfig(status);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  }[size];

  // Pick suitable Lucide icon
  const renderIcon = () => {
    switch (status) {
      case "draft":
        return <FileText className="h-3.5 w-3.5" />;
      case "submitted":
        return <Clock className="h-3.5 w-3.5" />;
      case "accepted":
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "fulfilled":
        return <CheckCheck className="h-3.5 w-3.5" />;
      case "rejected":
        return <XCircle className="h-3.5 w-3.5" />;
      case "cancelled":
        return <AlertCircle className="h-3.5 w-3.5" />;
      default:
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses}`}
      title={config.description}
    >
      {renderIcon()}
      {config.label}
    </span>
  );
}
