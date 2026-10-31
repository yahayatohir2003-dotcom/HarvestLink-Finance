"use client";

import React, { useState } from "react";
import {
  X,
  PlusCircle,
  Calendar,
  FileText,
  Loader2,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  NIGERIAN_FULFILMENT_MILESTONE_PRESETS,
  FulfilmentMilestoneStatus,
} from "@/types/fulfilment";
import { createMilestoneAction } from "@/app/dashboard/purchase-orders/[id]/fulfilment-actions";

interface AddMilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId: string;
  orderReference: string;
  onSuccess?: () => void;
}

export function AddMilestoneModal({
  isOpen,
  onClose,
  purchaseOrderId,
  orderReference,
  onSuccess,
}: AddMilestoneModalProps) {
  const [milestoneName, setMilestoneName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<FulfilmentMilestoneStatus>("pending");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (presetName: string, leadDays: number) => {
    setMilestoneName(presetName);
    const target = new Date(Date.now() + 86400000 * leadDays);
    setTargetDate(target.toISOString().split("T")[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!milestoneName.trim()) {
      setErrorMessage("Please enter or select a milestone name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createMilestoneAction({
        purchase_order_id: purchaseOrderId,
        milestone_name: milestoneName.trim(),
        target_date: targetDate || null,
        status: status,
        notes: notes.trim() || null,
      });

      if (!res.success) {
        setErrorMessage(res.message);
        setIsSubmitting(false);
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create milestone.");
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Log Fulfilment Milestone
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

          {/* Preset Suggestions */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Standard Agricultural Stages
            </span>
            <div className="flex flex-wrap gap-1.5">
              {NIGERIAN_FULFILMENT_MILESTONE_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleSelectPreset(p.name, p.typicalLeadTimeDays)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all text-left ${
                    milestoneName === p.name
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-bold shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Milestone Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Milestone Activity / Stage Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={milestoneName}
              onChange={(e) => setMilestoneName(e.target.value)}
              placeholder="e.g. Commodity Aggregation at Kano Depot"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 shadow-xs"
            />
          </div>

          {/* Target Date & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Target Completion Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 shadow-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FulfilmentMilestoneStatus)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 shadow-xs"
              >
                <option value="pending">Pending (Scheduled)</option>
                <option value="in_progress">In Progress (Active)</option>
                <option value="completed">Completed (Accomplished)</option>
                <option value="delayed">Delayed (Blocked)</option>
              </select>
            </div>
          </div>

          {/* Progress Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Progress Notes / Logistics Details (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Haulage truck plate KMC-492-XA dispatched from Kano with 300 MT Yellow Maize. Expected offloading at Apapa terminal in 48 hours."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 shadow-xs resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-60 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <PlusCircle className="h-3.5 w-3.5" />
                  Record Milestone
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
