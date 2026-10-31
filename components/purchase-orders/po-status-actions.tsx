"use client";

/**
 * HarvestLink Finance - Purchase Order Status Actions Toolbar
 *
 * Provides role-governed workflow action buttons on the Purchase Order detail view:
 * - Buyers can submit drafts or cancel pending orders.
 * - Suppliers can accept, reject, or mark orders as fulfilled.
 * - Platform Administrators have full oversight and override capabilities.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send,
  CheckCircle2,
  XCircle,
  CheckCheck,
  AlertOctagon,
  Edit,
  Loader2,
} from "lucide-react";
import { PurchaseOrderStatus } from "@/types/purchase-order";
import { updatePurchaseOrderStatusAction } from "@/app/dashboard/purchase-orders/actions";

interface PoStatusActionsProps {
  orderId: string;
  orderReference: string;
  currentStatus: PurchaseOrderStatus;
  userRole: "buyer" | "supplier" | "financier" | "admin" | string;
  isBuyer: boolean;
  isSupplier: boolean;
}

export function PoStatusActions({
  orderId,
  orderReference,
  currentStatus,
  userRole,
  isBuyer,
  isSupplier,
}: PoStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: PurchaseOrderStatus, promptReason = false) => {
    let reason: string | undefined = undefined;
    if (promptReason) {
      const inputReason = window.prompt(`Please provide an optional reason for transitioning to '${newStatus}':`);
      if (inputReason === null) return; // cancelled prompt
      reason = inputReason.trim() || undefined;
    } else {
      const confirmMsg = `Are you sure you want to change order ${orderReference} status to '${newStatus}'?`;
      if (!window.confirm(confirmMsg)) return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await updatePurchaseOrderStatusAction(orderId, newStatus, reason);
      if (!res.success) {
        setError(res.message || "Failed to update order status.");
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = userRole === "admin";

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* BUYER ACTIONS */}
        {(isBuyer || isAdmin) && currentStatus === "draft" && (
          <>
            <Link
              href={`/dashboard/purchase-orders/${orderId}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <Edit className="h-3.5 w-3.5 text-slate-500" />
              Edit Draft
            </Link>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleStatusChange("submitted")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-900 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit to Supplier
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleStatusChange("cancelled", true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel Draft
            </button>
          </>
        )}

        {(isBuyer || isAdmin) && currentStatus === "submitted" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleStatusChange("cancelled", true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Cancel Order
          </button>
        )}

        {/* SUPPLIER ACTIONS */}
        {(isSupplier || isAdmin) && currentStatus === "submitted" && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleStatusChange("accepted")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-900 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Accept Purchase Order
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleStatusChange("rejected", true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Decline / Reject Order
            </button>
          </>
        )}

        {(isSupplier || isAdmin) && currentStatus === "accepted" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleStatusChange("fulfilled")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-800 px-4 py-2 text-xs font-bold text-white shadow hover:bg-brand-900 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Mark Order as Fulfilled
          </button>
        )}
      </div>
    </div>
  );
}
