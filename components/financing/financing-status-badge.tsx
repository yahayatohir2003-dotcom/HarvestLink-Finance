import React from "react";
import {
  FileText,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Undo2,
} from "lucide-react";
import {
  FinancingRequestStatus,
  FINANCING_STATUS_CONFIGS,
} from "@/types/financing";

interface FinancingStatusBadgeProps {
  status: FinancingRequestStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

/**
 * Visual badge for financing request status values matching PostgreSQL check constraints
 */
export function FinancingStatusBadge({
  status,
  size = "md",
  showIcon = true,
}: FinancingStatusBadgeProps) {
  const config =
    FINANCING_STATUS_CONFIGS[status] || FINANCING_STATUS_CONFIGS.submitted;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  function renderIcon() {
    if (!showIcon) return null;
    const cls = `${iconSizes[size]} shrink-0`;
    switch (status) {
      case "draft":
        return <FileText className={cls} />;
      case "submitted":
        return <Clock className={cls} />;
      case "under_review":
        return <Eye className={cls} />;
      case "approved":
        return <CheckCircle2 className={cls} />;
      case "declined":
        return <XCircle className={cls} />;
      case "withdrawn":
        return <Undo2 className={cls} />;
      default:
        return <Clock className={cls} />;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold border shadow-sm ${config.badgeClass} ${sizeClasses[size]}`}
      title={config.description}
    >
      {renderIcon()}
      <span>{config.label}</span>
    </span>
  );
}
