"use client";

/**
 * HarvestLink Finance - Invoice Workflow Status Actions & Settlement Modal
 *
 * Provides role-governed actions for:
 * - Suppliers issuing drafts or cancelling invoices
 * - Buyers / Reviewers recording settlement coordination in 'settlements' table
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  XCircle,
  CreditCard,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Receipt,
  FileCheck2,
} from "lucide-react";
import { InvoiceStatus, SettlementStatus } from "@/types/invoice";
import {
  updateInvoiceStatusAction,
  recordSettlementCoordinationAction,
} from "@/app/dashboard/invoices/actions";
import { formatCurrencyNGN } from "@/lib/utils";

interface InvoiceStatusActionsProps {
  invoiceId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  currentStatus: InvoiceStatus;
  purchaseOrderId: string;
  orderReference: string;
  userRole: string;
  isSupplier: boolean;
  isBuyer: boolean;
  remainingBalance?: number;
}

export function InvoiceStatusActions({
  invoiceId,
  invoiceNumber,
  invoiceAmount,
  currentStatus,
  purchaseOrderId,
  orderReference,
  userRole,
  isSupplier,
  isBuyer,
  remainingBalance,
}: InvoiceStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeRemaining = typeof remainingBalance === "number" ? remainingBalance : invoiceAmount;

  // Settlement modal state
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState<number>(activeRemaining > 0 ? activeRemaining : invoiceAmount);
  const [paymentReference, setPaymentReference] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");
  const [isSimulated, setIsSimulated] = useState(false);

  const isAdmin = userRole === "admin";
  const isFinancier = userRole === "financier";
  const canDirectlyVerify = isFinancier || isAdmin;

  // If reviewer can directly verify, allow picking 'paid' or 'pending'; otherwise external claims default to 'pending'
  const [settlementStatus, setSettlementStatus] = useState<SettlementStatus>(
    canDirectlyVerify ? "paid" : "pending"
  );

  const handleStatusChange = async (newStatus: InvoiceStatus, promptReason = false) => {
    let reason: string | undefined = undefined;
    if (promptReason) {
      const inputReason = window.prompt(`Please provide an optional reason for shifting invoice to '${newStatus}':`);
      if (inputReason === null) return;
      reason = inputReason.trim() || undefined;
    } else {
      if (!window.confirm(`Are you sure you want to change invoice ${invoiceNumber} status to '${newStatus}'?`)) {
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await updateInvoiceStatusAction({
        invoice_id: invoiceId,
        status: newStatus,
        reason,
      });

      if (!res.success) {
        setError(res.message);
      } else {
        setSuccess(res.message);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settlementAmount <= 0) {
      setError("Settlement amount must be greater than zero.");
      return;
    }

    if (!isSimulated && settlementAmount > activeRemaining) {
      setError(`Settlement amount (₦${settlementAmount.toLocaleString()}) cannot exceed remaining balance (₦${activeRemaining.toLocaleString()}).`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await recordSettlementCoordinationAction({
        purchase_order_id: purchaseOrderId,
        invoice_id: invoiceId,
        amount: settlementAmount,
        status: isSimulated ? settlementStatus : canDirectlyVerify ? settlementStatus : "pending",
        payment_reference: paymentReference.trim() || undefined,
        notes: settlementNotes.trim() || undefined,
        is_simulated: isSimulated,
      });

      if (!res.success) {
        setError(res.message);
      } else {
        setSuccess(res.message);
        setShowSettlementModal(false);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record settlement.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {success}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* SUPPLIER ACTIONS */}
        {(isSupplier || isAdmin) && currentStatus === "draft" && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleStatusChange("issued")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Issue Invoice to Buyer
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleStatusChange("cancelled", true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5 text-slate-400" />
              Cancel Draft
            </button>
          </>
        )}

        {(isSupplier || isAdmin) && currentStatus === "issued" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleStatusChange("cancelled", true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Void / Cancel Invoice
          </button>
        )}

        {/* BUYER / FINANCIER / ADMIN SETTLEMENT COORDINATION */}
        {(isBuyer || isFinancier || isAdmin) && currentStatus !== "cancelled" && currentStatus !== "draft" && (
          <button
            type="button"
            disabled={loading || (activeRemaining <= 0 && currentStatus === "paid")}
            onClick={() => {
              setSettlementAmount(activeRemaining > 0 ? activeRemaining : invoiceAmount);
              setShowSettlementModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-900 disabled:opacity-50 transition-colors"
          >
            <CreditCard className="h-3.5 w-3.5" />
            {canDirectlyVerify ? "Record & Reconcile Settlement" : "Log Payment Reference"}
          </button>
        )}

        {(isAdmin || isBuyer) && currentStatus === "issued" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleStatusChange("overdue", true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Flag as Overdue
          </button>
        )}
      </div>

      {/* SETTLEMENT MODAL */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  {canDirectlyVerify ? "Record & Reconcile Trade Settlement" : "Submit Payment Reference Claim"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettlementModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Non-custodial Scope Notice */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Non-Custodial Ledger Notice:
              </span>
              <p className="text-[11px] leading-relaxed text-amber-800">
                HarvestLink tracks verified trade settlement data. The platform does not hold funds, initiate direct bank debits, or process card PINs. A submitted reference is an unverified claim until reconciled against bank credit advice.
              </p>
            </div>

            {/* Simulation Mode Toggle */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block text-xs">
                  Sandbox Simulation Mode
                </span>
                <span className="text-[11px] text-slate-500">
                  Mark as simulated test record (`is_simulated = true`). Will not mark invoice paid.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isSimulated}
                onChange={(e) => setIsSimulated(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
              />
            </div>

            {isSimulated && (
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-3 text-xs text-purple-900 font-semibold">
                ⚠️ Simulation Record: This entry will be explicitly labeled &ldquo;Simulated settlement — not proof of payment&rdquo;. It will not decrement the invoice balance.
              </div>
            )}

            <form onSubmit={handleRecordSettlement} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Settlement Amount (₦) *
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Remaining Balance: {formatCurrencyNGN(activeRemaining)}
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max={isSimulated ? undefined : activeRemaining}
                  step="0.01"
                  required
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Total Invoiced Face Value: {formatCurrencyNGN(invoiceAmount)}
                </span>
              </div>

              {canDirectlyVerify ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Reconciliation Status *
                  </label>
                  <select
                    value={settlementStatus}
                    onChange={(e) => setSettlementStatus(e.target.value as SettlementStatus)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    <option value="paid">Verified Paid / Reconciled against Statement</option>
                    <option value="pending">Pending Institutional Verification</option>
                    <option value="failed">Failed / Bank Advice Discrepancy</option>
                  </select>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-700 block mb-0.5">Claim Verification Status:</span>
                  Submitted records are assigned status <span className="font-bold text-amber-700">Pending</span> until reconciled by an authorized credit reviewer or administrator.
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bank Reference / NIBSS Session ID / Receipt No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. NIBSS-090267-2849182"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Must be unique across all transactions.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reconciliation / Transaction Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Direct corporate bank transfer from First Bank to Zenith Bank verified via statement."
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50 transition-colors"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isSimulated ? "Record Simulated Test" : canDirectlyVerify ? "Confirm & Reconcile" : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
