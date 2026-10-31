"use client";

/**
 * HarvestLink Finance - Settlement Reconciliation Ledger Card
 *
 * Implements Step 8 Reconciliation UI:
 * - Aggregated balance KPIs: Total Invoiced, Verified Reconciled, Pending Claims, Remaining Balance
 * - Progress bar showing percentage settled
 * - Explicit labeling of Simulated records vs Unverified Claims vs Verified Settlements
 * - Row-level verification / rejection actions for Financier and Admin roles
 * - Non-custodial boundary disclaimers
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Loader2,
  HelpCircle,
} from "lucide-react";
import {
  SettlementRecord,
  InvoiceStatus,
  calculateInvoiceReconciliation,
} from "@/types/invoice";
import { reconcileSettlementAction } from "@/app/dashboard/invoices/actions";
import { formatCurrencyNGN } from "@/lib/utils";

interface SettlementReconciliationCardProps {
  invoiceId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  invoiceStatus: InvoiceStatus;
  settlements: SettlementRecord[];
  userRole: string;
}

export function SettlementReconciliationCard({
  invoiceId,
  invoiceNumber,
  invoiceAmount,
  invoiceStatus,
  settlements,
  userRole,
}: SettlementReconciliationCardProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const canReconcile = userRole === "financier" || userRole === "admin";
  const reconciliation = calculateInvoiceReconciliation(
    invoiceAmount,
    invoiceStatus,
    settlements
  );

  const [pendingDecision, setPendingDecision] = useState<{
    settlementId: string;
    decision: "verify" | "reject";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const handleOpenReviewModal = (settlementId: string, decision: "verify" | "reject") => {
    setPendingDecision({ settlementId, decision });
    setReviewNote("");
  };

  const handleConfirmReviewDecision = async () => {
    if (!pendingDecision) return;
    const { settlementId, decision } = pendingDecision;

    setLoadingId(settlementId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await reconcileSettlementAction({
        settlement_id: settlementId,
        decision,
        review_notes: reviewNote.trim() || undefined,
      });

      if (!res.success) {
        setActionError(res.message);
      } else {
        setActionSuccess(res.message);
        setPendingDecision(null);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reconciliation action failed.";
      setActionError(msg);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header & Disclaimers */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-700" />
            Settlement Reconciliation Ledger
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Non-custodial bank settlement tracking and cumulative balance reconciliation
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          Status:{" "}
          <span className="capitalize font-mono font-bold text-slate-900">
            {reconciliation.reconciliationState.replace("_", " ")}
          </span>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {actionSuccess}
        </div>
      )}

      {/* 4-Metric Reconciliation Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Total Invoiced
          </span>
          <span className="text-lg font-extrabold text-slate-900 font-mono block">
            {formatCurrencyNGN(reconciliation.totalInvoiced)}
          </span>
          <span className="text-[11px] text-slate-500 block">Commercial contract total</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">
            Reconciled Paid
          </span>
          <span className="text-lg font-extrabold text-emerald-900 font-mono block">
            {formatCurrencyNGN(reconciliation.reconciledPaid)}
          </span>
          <span className="text-[11px] text-emerald-700 block">
            {reconciliation.reconciledCount} verified settlement{reconciliation.reconciledCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">
            Pending Claims
          </span>
          <span className="text-lg font-extrabold text-amber-900 font-mono block">
            {formatCurrencyNGN(reconciliation.pendingClaims)}
          </span>
          <span className="text-[11px] text-amber-700 block">
            {reconciliation.pendingCount} unverified reference{reconciliation.pendingCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
            Remaining Balance
          </span>
          <span className={`text-lg font-extrabold font-mono block ${
            reconciliation.remainingBalance === 0 ? "text-emerald-700" : "text-slate-900"
          }`}>
            {formatCurrencyNGN(reconciliation.remainingBalance)}
          </span>
          <span className="text-[11px] text-slate-500 block">
            {reconciliation.percentSettled}% settled
          </span>
        </div>
      </div>

      {/* Settlement Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs text-slate-600 font-semibold">
          <span>Reconciliation Progress</span>
          <span className="font-mono text-emerald-800">{reconciliation.percentSettled}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              reconciliation.percentSettled === 100
                ? "bg-emerald-600"
                : reconciliation.percentSettled > 0
                ? "bg-amber-500"
                : "bg-slate-300"
            }`}
            style={{ width: `${reconciliation.percentSettled}%` }}
          />
        </div>
      </div>

      {/* Settlements List */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Recorded Settlement Entries ({settlements.length})
        </h4>

        {settlements.length > 0 ? (
          <div className="space-y-3">
            {settlements.map((s) => {
              const isSim = s.is_simulated;
              const isPaid = s.status === "paid" && !isSim;
              const isPending = s.status === "pending" && !isSim;
              const isFailed = s.status === "failed";
              const isLoading = loadingId === s.id;

              return (
                <div
                  key={s.id}
                  className={`rounded-xl border p-4 text-xs space-y-3 transition-colors ${
                    isSim
                      ? "border-purple-200 bg-purple-50/30"
                      : isPaid
                      ? "border-emerald-200 bg-emerald-50/30"
                      : isPending
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isPaid ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : isPending ? (
                        <Clock className="h-4 w-4 text-amber-600" />
                      ) : isSim ? (
                        <AlertTriangle className="h-4 w-4 text-purple-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500" />
                      )}

                      <span className="font-extrabold font-mono text-sm text-slate-900">
                        {formatCurrencyNGN(Number(s.amount))}
                      </span>

                      {/* State Badge */}
                      {isSim ? (
                        <span className="rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 uppercase">
                          Simulated Record
                        </span>
                      ) : isPaid ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                          Verified Paid
                        </span>
                      ) : isPending ? (
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                          Unverified Claim (Pending)
                        </span>
                      ) : (
                        <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                          Failed / Rejected
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400">
                      Logged {new Date(s.created_at).toLocaleDateString("en-NG")}
                    </span>
                  </div>

                  {/* Warning banner for simulations */}
                  {isSim && (
                    <div className="rounded-lg bg-purple-100/70 border border-purple-200 px-2.5 py-1.5 text-[11px] text-purple-900 font-semibold">
                      Simulated settlement — not proof of payment. This entry does not decrement the invoice balance.
                    </div>
                  )}

                  {/* Warning banner for unverified claims */}
                  {isPending && (
                    <div className="rounded-lg bg-amber-100/70 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-900">
                      User-submitted reference claim. HarvestLink has not independently confirmed that funds moved.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      <span className="text-slate-400 font-medium">Payment Reference:</span>{" "}
                      <span className="font-mono font-semibold text-slate-900">
                        {s.payment_reference || "None specified"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium">Reconciled At:</span>{" "}
                      <span>
                        {s.settled_at
                          ? new Date(s.settled_at).toLocaleDateString("en-NG")
                          : "Pending Reconciliation"}
                      </span>
                    </div>
                  </div>

                  {s.notes && (
                    <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200">
                      &ldquo;{s.notes}&rdquo;
                    </p>
                  )}

                  {/* Reviewer Actions for Pending Unverified Claims */}
                  {canReconcile && isPending && !isSim && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-amber-200/60">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleOpenReviewModal(s.id, "reject")}
                        className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                      >
                        Reject Claim
                      </button>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleOpenReviewModal(s.id, "verify")}
                        className="min-h-[40px] inline-flex items-center gap-1 rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        Verify & Reconcile Payment
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            No settlement tracking records logged for this invoice yet.
          </div>
        )}
      </div>

      {/* Review Decision Modal */}
      {pendingDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {pendingDecision.decision === "verify" ? "Confirm Settlement Verification" : "Reject Settlement Claim"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {pendingDecision.decision === "verify"
                ? "Confirm that bank funds have been verified and reconcile this settlement toward the outstanding invoice balance."
                : "Mark this settlement claim as failed or invalid. The invoice balance will remain uncredited."}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Audit Review Notes (Optional)
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="e.g. Verified against bank statement reference #12345..."
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingDecision(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loadingId !== null}
                onClick={handleConfirmReviewDecision}
                className={`min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm ${
                  pendingDecision.decision === "verify"
                    ? "bg-emerald-800 hover:bg-emerald-900"
                    : "bg-rose-700 hover:bg-rose-800"
                }`}
              >
                {loadingId !== null && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {pendingDecision.decision === "verify" ? "Confirm & Reconcile" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
