"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Scale,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  AlertTriangle,
  History,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import {
  FinancingRequestStatus,
  FinancingReviewDecision,
  FinancingReviewRecord,
} from "@/types/financing";
import {
  submitFinancingReviewAction,
  updateFinancingRequestStatusAction,
} from "@/app/dashboard/financing/actions";

interface FinancingDecisionCardProps {
  requestId: string;
  currentStatus: FinancingRequestStatus;
  requestedAmount: number;
  poReference: string;
  canReview: boolean;
  reviews?: FinancingReviewRecord[];
}

export function FinancingDecisionCard({
  requestId,
  currentStatus,
  requestedAmount,
  poReference,
  canReview,
  reviews = [],
}: FinancingDecisionCardProps) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<FinancingReviewDecision | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isConcluded =
    currentStatus === "approved" ||
    currentStatus === "declined" ||
    currentStatus === "withdrawn";

  async function handleMarkUnderReview() {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await updateFinancingRequestStatusAction(requestId, "under_review");
      if (res.success) {
        setSuccessMsg("Application status updated to Under Review.");
        router.refresh();
      } else {
        setErrorMsg(res.message || "Failed to update review status.");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error initiating review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDecision() {
    if (!pendingDecision) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await submitFinancingReviewAction({
        financing_request_id: requestId,
        decision: pendingDecision,
        comments,
      });

      if (res.success) {
        setSuccessMsg(res.message || `Decision '${pendingDecision}' recorded successfully.`);
        setShowConfirmModal(false);
        setComments("");
        router.refresh();
      } else {
        setErrorMsg(res.message || "Failed to record review decision.");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error recording review decision.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Institutional Underwriting Desk
              </h3>
              <p className="text-xs text-blue-200">
                Credit evaluation and risk assessment for {poReference}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            financing_reviews
          </span>
        </div>
      </div>

      <div className="p-6 pt-0 space-y-6">
        {/* Messages */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Reviewer Action Controls (for Reviewers & Admins) */}
        {canReview && !isConcluded ? (
          <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100/60 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Record Underwriting Decision
                </h4>
                <p className="text-xs text-slate-500">
                  Evaluate submitted documentation and counterparty performance history.
                </p>
              </div>

              {currentStatus === "submitted" && (
                <button
                  type="button"
                  onClick={handleMarkUnderReview}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors shadow-sm self-start"
                >
                  <Eye className="h-3.5 w-3.5 text-amber-700" />
                  Mark as Under Review
                </button>
              )}
            </div>

            {/* Comments input */}
            <div>
              <label
                htmlFor="reviewComments"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Underwriting Rationale / Conditions (saved to financing_reviews.comments)
              </label>
              <textarea
                id="reviewComments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Detail approval covenants, interest margins, required collateral, or reasons for decline..."
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDecision("declined");
                  setShowConfirmModal(true);
                }}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-50 hover:text-rose-900 transition-colors"
              >
                <XCircle className="h-4 w-4 text-rose-600" />
                Decline Request
              </button>

              <button
                type="button"
                onClick={() => {
                  setPendingDecision("approved");
                  setShowConfirmModal(true);
                }}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-100" />
                Approve Financing (₦{requestedAmount.toLocaleString()})
              </button>
            </div>
          </div>
        ) : isConcluded ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <ShieldCheck className="h-6 w-6 text-slate-500 mx-auto" />
            <p className="mt-2 text-xs font-semibold text-slate-700">
              Underwriting review completed. This application is concluded as{" "}
              <span className="font-bold uppercase tracking-wider">{currentStatus}</span>.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-xs text-slate-500">
              Underwriting controls are restricted to verified institutional financing partners.
            </p>
          </div>
        )}

        {/* Previous Review Decisions Timeline */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-slate-600" />
            Decision History ({reviews.length})
          </h4>

          {reviews.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              No formal underwriting decisions recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                        rev.decision === "approved"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      }`}
                    >
                      {rev.decision === "approved" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {rev.decision.toUpperCase()}
                    </span>

                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(rev.reviewed_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-800">
                    Reviewer:{" "}
                    <span className="font-normal text-slate-600">
                      {rev.reviewerProfile?.full_name || "Institutional Reviewer"}
                    </span>
                  </p>

                  {rev.comments && (
                    <div className="mt-2 rounded-lg bg-white border border-slate-200 p-2.5 text-xs text-slate-700 flex items-start gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-line">{rev.comments}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform Governance Notice */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-[11px] text-blue-900 leading-relaxed">
          <span className="font-bold">Governance Notice:</span> HarvestLink is a transaction
          coordination platform. Approvals signify credit facility eligibility under partner
          underwriting terms. HarvestLink does not disburse funds or hold escrow balances.
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && pendingDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  pendingDecision === "approved"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {pendingDecision === "approved" ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <XCircle className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm {pendingDecision === "approved" ? "Approval" : "Decline"}
                </h3>
                <p className="text-xs text-slate-500">
                  This decision will update the application status and notify counterparties.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
              <p>
                <span className="font-semibold text-slate-900">Purchase Order:</span> {poReference}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Facility Amount:</span> ₦
                {requestedAmount.toLocaleString()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Review Comments:</span>{" "}
                {comments ? comments : "(None provided)"}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDecision}
                disabled={isSubmitting}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow ${
                  pendingDecision === "approved"
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : "bg-rose-700 hover:bg-rose-800"
                }`}
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  Confirm {pendingDecision === "approved" ? "Approval" : "Decline"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
