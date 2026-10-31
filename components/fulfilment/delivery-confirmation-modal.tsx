"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertOctagon,
  Calendar,
  User,
  Scale,
  FileText,
  Paperclip,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { DocumentRecord } from "@/types/document";
import { submitDeliveryConfirmationAction } from "@/app/dashboard/purchase-orders/[id]/fulfilment-actions";

interface DeliveryConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId: string;
  orderReference: string;
  totalOrderedQuantity?: number;
  availableDocuments: DocumentRecord[];
  onSuccess?: () => void;
}

export function DeliveryConfirmationModal({
  isOpen,
  onClose,
  purchaseOrderId,
  orderReference,
  totalOrderedQuantity,
  availableDocuments,
  onSuccess,
}: DeliveryConfirmationModalProps) {
  const [outcome, setOutcome] = useState<"confirmed" | "disputed">("confirmed");
  const [receivedByName, setReceivedByName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 16));
  const [quantityReceived, setQuantityReceived] = useState<string>(
    totalOrderedQuantity ? totalOrderedQuantity.toString() : ""
  );
  const [conditionNotes, setConditionNotes] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!receivedByName.trim()) {
      setErrorMessage("Please enter the name of the receiving warehouse / intake officer.");
      return;
    }

    const qty = quantityReceived.trim() ? Number(quantityReceived) : null;
    if (qty !== null && (isNaN(qty) || qty < 0)) {
      setErrorMessage("Please enter a valid non-negative received quantity.");
      return;
    }

    if (outcome === "disputed" && !conditionNotes.trim()) {
      setErrorMessage("Please provide notes explaining the reason for disputing this delivery.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitDeliveryConfirmationAction({
        purchase_order_id: purchaseOrderId,
        received_by_name: receivedByName.trim(),
        delivery_date: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        quantity_received: qty,
        condition_notes: conditionNotes.trim() || null,
        evidence_document_id: evidenceDocumentId || null,
        status: outcome,
      });

      if (!res.success) {
        setErrorMessage(res.message);
        setIsSubmitting(false);
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to record delivery confirmation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Record Delivery Intake Receipt
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Order: {orderReference}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
              {errorMessage}
            </div>
          )}

          {/* Outcome Selector: Confirm vs Dispute */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Delivery Inspection Outcome <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  outcome === "confirmed"
                    ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="outcome"
                  value="confirmed"
                  checked={outcome === "confirmed"}
                  onChange={() => setOutcome("confirmed")}
                  className="sr-only"
                />
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${outcome === "confirmed" ? "text-emerald-700" : "text-slate-400"}`} />
                <div className="text-xs">
                  <span className="block font-bold">Confirm Receipt</span>
                  <span className="text-[10px] font-normal opacity-80 block">Goods accepted; mark fulfilled</span>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  outcome === "disputed"
                    ? "border-rose-600 bg-rose-50/70 text-rose-950 font-bold shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="outcome"
                  value="disputed"
                  checked={outcome === "disputed"}
                  onChange={() => setOutcome("disputed")}
                  className="sr-only"
                />
                <AlertOctagon className={`h-4 w-4 shrink-0 ${outcome === "disputed" ? "text-rose-700" : "text-slate-400"}`} />
                <div className="text-xs">
                  <span className="block font-bold">Dispute Delivery</span>
                  <span className="text-[10px] font-normal opacity-80 block">Report shortage or damage</span>
                </div>
              </label>
            </div>
          </div>

          {/* Receiving Officer & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Receiving Officer / Manager <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={receivedByName}
                onChange={(e) => setReceivedByName(e.target.value)}
                placeholder="e.g. Segun Adeyemi (Warehouse Lead)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600 shadow-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Delivery Date & Time
              </label>
              <input
                type="datetime-local"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600 shadow-xs"
              />
            </div>
          </div>

          {/* Quantity Received */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-slate-400" />
                Quantity Received & Accepted
              </label>
              {totalOrderedQuantity && (
                <span className="text-[10px] text-slate-400 font-mono">
                  Contract: {totalOrderedQuantity.toLocaleString()}
                </span>
              )}
            </div>
            <input
              type="number"
              step="any"
              min="0"
              value={quantityReceived}
              onChange={(e) => setQuantityReceived(e.target.value)}
              placeholder="e.g. 300"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          {/* Link Existing Supporting Evidence Document */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5 text-slate-400" />
              Delivery Evidence Document (Waybill / Weighbridge Ticket)
            </label>
            <select
              value={evidenceDocumentId}
              onChange={(e) => setEvidenceDocumentId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600 shadow-xs"
            >
              <option value="">-- Select attached document (optional) --</option>
              {availableDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.document_type.replace(/_/g, " ").toUpperCase()}: {doc.original_filename}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">
              Select a signed waybill, goods received note (GRN), or tally sheet already uploaded to this order.
            </p>
          </div>

          {/* Condition Notes & Quality Remarks */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Condition Notes & Intake Remarks {outcome === "disputed" && <span className="text-rose-600">*</span>}
            </label>
            <textarea
              rows={3}
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder={
                outcome === "confirmed"
                  ? "e.g. Moisture content tested at 11.8%. Grain bags sound and undamaged. Stored in Silo Bay 3."
                  : "e.g. Consignment short by 25 MT. 40 bags torn with water damage in transit. Driver noted discrepancy on waybill."
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600 shadow-xs resize-none"
            />
          </div>

          {/* Platform Coordination Notice */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-[11px] text-blue-900 leading-relaxed">
            <span className="font-bold">Platform Governance:</span> HarvestLink Finance records confirmations submitted by authorized counterparties. HarvestLink does not physically transport goods or independently certify delivery.
          </div>

          {/* Modal Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs transition-all ${
                outcome === "confirmed"
                  ? "bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60"
                  : "bg-rose-700 hover:bg-rose-800 disabled:opacity-60"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : outcome === "confirmed" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Delivery
                </>
              ) : (
                <>
                  <AlertOctagon className="h-4 w-4" />
                  Submit Dispute
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
