import React from "react";
import { InvoiceStatus, INVOICE_STATUS_CONFIG } from "@/types/invoice";
import {
  FileText,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus | string;
  size?: "sm" | "md" | "lg";
}

/**
 * Visual badge displaying the current status of a commercial invoice
 * with color accents aligned with HarvestLink Finance design system.
 */
export function InvoiceStatusBadge({
  status,
  size = "md",
}: InvoiceStatusBadgeProps) {
  const typedStatus = (status in INVOICE_STATUS_CONFIG ? status : "draft") as InvoiceStatus;
  const config = INVOICE_STATUS_CONFIG[typedStatus];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  }[size];

  const renderIcon = () => {
    switch (typedStatus) {
      case "draft":
        return <FileText className="h-3 w-3" />;
      case "issued":
        return <Send className="h-3 w-3" />;
      case "partially_paid":
        return <Clock className="h-3 w-3" />;
      case "paid":
        return <CheckCircle2 className="h-3 w-3" />;
      case "overdue":
        return <AlertTriangle className="h-3 w-3" />;
      case "cancelled":
        return <XCircle className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
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
