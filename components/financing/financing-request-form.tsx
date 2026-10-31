"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Coins,
  Building,
  FileCheck2,
  AlertTriangle,
  Loader2,
  Percent,
  CheckCircle2,
  FileText,
  Send,
  Save,
  ShieldCheck,
} from "lucide-react";
import { createFinancingRequestAction } from "@/app/dashboard/financing/actions";

interface EligiblePO {
  id: string;
  order_reference: string;
  total_amount: number;
  status: string;
  issue_date: string;
  buyer_name: string;
  item_count: number;
}

interface FinancingRequestFormProps {
  eligibleOrders: EligiblePO[];
  preselectedPoId?: string;
}

export function FinancingRequestForm({
  eligibleOrders,
  preselectedPoId,
}: FinancingRequestFormProps) {
  const router = useRouter();

  const [selectedPoId, setSelectedPoId] = useState<string>(preselectedPoId || "");
  const [requestedAmount, setRequestedAmount] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Find currently selected PO details
  const selectedPo = eligibleOrders.find((p) => p.id === selectedPoId);

  // Set default requested amount to 80% of PO value when a PO is selected
  useEffect(() => {
    if (selectedPo && !requestedAmount) {
      const defaultAmount = Math.round(selectedPo.total_amount * 0.8);
      setRequestedAmount(defaultAmount.toString());
    }
  }, [selectedPo, requestedAmount]);

  const numAmount = Number(requestedAmount) || 0;
  const poTotal = selectedPo?.total_amount || 0;
  const ratioPercent = poTotal > 0 ? ((numAmount / poTotal) * 100).toFixed(1) : "0.0";
  const isOverLimit = poTotal > 0 && numAmount > poTotal;

  function setPercentage(pct: number) {
    if (!selectedPo) return;
    const calculated = Math.round(selectedPo.total_amount * (pct / 100));
    setRequestedAmount(calculated.toString());
  }

  async function handleSubmit(asDraft: boolean) {
    if (!selectedPoId) {
      setErrorMsg("Please select an eligible purchase order.");
      return;
    }

    if (numAmount <= 0) {
      setErrorMsg("Requested amount must be greater than zero.");
      return;
    }

    if (numAmount > poTotal) {
      setErrorMsg(
        `Requested financing amount (₦${numAmount.toLocaleString()}) cannot exceed the purchase order value (₦${poTotal.toLocaleString()}).`
      );
      return;
    }

    if (!purpose.trim() || purpose.trim().length < 5) {
      setErrorMsg("Please provide a financing purpose or explanation.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await createFinancingRequestAction({
        purchase_order_id: selectedPoId,
        requested_amount: numAmount,
        purpose: purpose.trim(),
        status: asDraft ? "draft" : "submitted",
      });

      if (res.success && res.data?.requestId) {
        setSuccessMsg(res.message || "Financing application processed successfully.");
        router.push(`/dashboard/financing/${res.data.requestId}`);
      } else {
        setErrorMsg(res.message || "Failed to submit financing application.");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error processing application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Non-Custodial Protocol Banner */}
      <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
        <span>
          <strong>Financing Protocol:</strong> HarvestLink Finance is a trade coordination platform. Financing reviews, underwriting, and terms are provided independently by partner institutions. HarvestLink does not extend credit or hold customer funds.
        </span>
      </div>

      {/* Form Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">

        {/* Step 1: Select Purchase Order */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              1
            </span>
            <label htmlFor="poSelect" className="text-sm font-bold text-slate-900">
              Select Confirmed Purchase Order
            </label>
          </div>

          {eligibleOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <FileCheck2 className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="mt-2 text-xs font-semibold text-slate-700">
                No eligible purchase orders found.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Only purchase orders in confirmed status without an active financing application can be financed.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                id="poSelect"
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
              >
                <option value="">-- Choose an eligible purchase order --</option>
                {eligibleOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.order_reference} — {po.buyer_name} (₦{po.total_amount.toLocaleString()}) • {po.item_count} items
                  </option>
                ))}
              </select>

              {/* Selected PO Preview Card */}
              {selectedPo && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-950 text-sm">
                      {selectedPo.order_reference}
                    </p>
                    <p className="flex items-center gap-1.5 text-slate-600">
                      <Building className="h-3.5 w-3.5 text-emerald-700" />
                      Buyer: <span className="font-semibold text-slate-900">{selectedPo.buyer_name}</span>
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Issue Date: {new Date(selectedPo.issue_date).toLocaleDateString("en-GB")} • Status: {selectedPo.status}
                    </p>
                  </div>

                  <div className="text-right sm:border-l sm:border-emerald-200 sm:pl-4">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 block">
                      Confirmed Contract Value
                    </span>
                    <span className="text-base font-extrabold text-emerald-900">
                      ₦{selectedPo.total_amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Requested Financing Amount */}
        {selectedPo && (
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                2
              </span>
              <label htmlFor="amountInput" className="text-sm font-bold text-slate-900">
                Requested Financing Capital (NGN)
              </label>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 font-bold text-sm">
                  ₦
                </span>
                <input
                  id="amountInput"
                  type="number"
                  min="1"
                  max={poTotal}
                  step="1000"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  placeholder="e.g. 5000000"
                  className={`w-full rounded-xl border p-3 pl-8 text-base font-bold focus:outline-none focus:ring-1 ${
                    isOverLimit
                      ? "border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-600 focus:ring-rose-600"
                      : "border-slate-300 bg-white text-slate-900 focus:border-emerald-600 focus:ring-emerald-600"
                  }`}
                />
              </div>

              {/* Percentage Quick Selectors */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Percent className="h-3 w-3" /> Quick Ratio:
                </span>
                {[50, 70, 80, 90, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPercentage(pct)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Ratio Feedback indicator */}
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-semibold ${
                    isOverLimit ? "text-rose-600" : "text-slate-600"
                  }`}
                >
                  Financing Ratio: {ratioPercent}% of PO Contract Value
                </span>

                <span className="text-slate-500 font-mono">
                  Max: ₦{poTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Financing Purpose / Use of Proceeds */}
        {selectedPo && (
          <div className="space-y-3 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                3
              </span>
              <label htmlFor="purposeInput" className="text-sm font-bold text-slate-900">
                Financing Purpose & Use of Proceeds
              </label>
            </div>

            <textarea
              id="purposeInput"
              rows={4}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Explain how the working capital will be utilized (e.g. procurement of 500 bags of paddy rice from local aggregators in Kebbi, transportation logistics to buyer mill, quality grading costs)..."
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 leading-relaxed"
            />
            <p className="text-[11px] text-slate-500">
              Clear breakdown of aggregation expenses increases underwriting review speed.
            </p>
          </div>
        )}

        {/* Action Controls */}
        {selectedPo && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-6">
            <p className="text-[11px] text-slate-500 text-center sm:text-left">
              Supporting trade documents (invoices, certificates) can be attached after creating the request.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting || isOverLimit}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <Save className="h-4 w-4 text-slate-500" />
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || isOverLimit}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 text-emerald-100" />
                )}
                <span>Submit Application for Review</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
