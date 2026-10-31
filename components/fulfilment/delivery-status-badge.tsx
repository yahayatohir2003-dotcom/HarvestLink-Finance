import React from "react";
import { Clock, CheckCircle2, AlertOctagon } from "lucide-react";
import { DeliveryConfirmationStatus, DELIVERY_STATUS_CONFIG } from "@/types/fulfilment";

interface DeliveryStatusBadgeProps {
  status: DeliveryConfirmationStatus;
  size?: "sm" | "md" | "lg";
}

export function DeliveryStatusBadge({
  status,
  size = "md",
}: DeliveryStatusBadgeProps) {
  const config = DELIVERY_STATUS_CONFIG[status] || DELIVERY_STATUS_CONFIG.pending;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const renderIcon = () => {
    switch (status) {
      case "pending":
        return <Clock className={iconSizes[size]} />;
      case "confirmed":
        return <CheckCircle2 className={iconSizes[size]} />;
      case "disputed":
        return <AlertOctagon className={iconSizes[size]} />;
      default:
        return <Clock className={iconSizes[size]} />;
    }
  };

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border shadow-xs transition-colors ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses[size]}`}
    >
      {renderIcon()}
      <span>{config.label}</span>
    </span>
  );
}
