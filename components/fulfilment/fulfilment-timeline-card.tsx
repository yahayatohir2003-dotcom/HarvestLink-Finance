"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertTriangle,
  ChevronRight,
  User,
  Loader2,
  Check,
} from "lucide-react";
import {
  EnrichedFulfilmentMilestone,
  FulfilmentMilestoneStatus,
} from "@/types/fulfilment";
import { MilestoneStatusBadge } from "./milestone-status-badge";
import { AddMilestoneModal } from "./add-milestone-modal";
import { updateMilestoneStatusAction } from "@/app/dashboard/purchase-orders/[id]/fulfilment-actions";

interface FulfilmentTimelineCardProps {
  purchaseOrderId: string;
  orderReference: string;
  orderStatus: string;
  milestones: EnrichedFulfilmentMilestone[];
  canManageMilestones: boolean; // Supplier or Admin
}

export function FulfilmentTimelineCard({
  purchaseOrderId,
  orderReference,
  orderStatus,
  milestones,
  canManageMilestones,
}: FulfilmentTimelineCardProps) {
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const progressPercent = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;
  const isOrderEligible = orderStatus === "accepted" || orderStatus === "fulfilled";

  const handleStatusChange = async (milestoneId: string, newStatus: FulfilmentMilestoneStatus) => {
    setUpdatingId(milestoneId);
    setUpdateError(null);

    try {
      const res = await updateMilestoneStatusAction({
        milestone_id: milestoneId,
        purchase_order_id: purchaseOrderId,
        status: newStatus,
      });

      if (!res.success) {
        setUpdateError(res.message);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update milestone.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
      {/* Card Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Fulfilment Milestone Tracking
              </h3>
              <p className="text-xs text-slate-500">
                Agricultural supply-chain execution timeline ({completedCount} of {milestones.length} completed)
              </p>
            </div>
          </div>
        </div>

        {canManageMilestones && isOrderEligible && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-all shrink-0"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Add Milestone</span>
          </button>
        )}
      </div>

      {updateError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
          {updateError}
        </div>
      )}

      {/* Progress Bar */}
      {milestones.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500">Fulfilment Progress</span>
            <span className="text-slate-900 font-mono">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                progressPercent === 100 ? "bg-emerald-600" : "bg-emerald-600"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Milestone List / Empty State */}
      {milestones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
          <Layers className="mx-auto h-8 w-8 text-slate-400" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-700">No fulfilment milestones recorded yet</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              {canManageMilestones
                ? "Record agricultural trade stages such as farmgate aggregation, grading, bagging, dispatch, and overland haulage."
                : "The supplier has not logged any fulfilment milestones for this order yet."}
            </p>
          </div>
          {canManageMilestones && isOrderEligible && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5 text-emerald-700" />
              <span>Log First Milestone</span>
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:bottom-3 before:top-3 before:left-[11px] before:w-0.5 before:bg-slate-200">
          {milestones.map((milestone, idx) => {
            const isCompleted = milestone.status === "completed";
            const isInProgress = milestone.status === "in_progress";
            const isDelayed = milestone.status === "delayed";
            const isUpdating = updatingId === milestone.id;

            return (
              <div key={milestone.id} className="relative group">
                {/* Timeline Pin Indicator */}
                <div
                  className={`absolute -left-6 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white transition-all ${
                    isCompleted
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : isInProgress
                      ? "border-blue-600 bg-blue-50 text-blue-700 animate-pulse"
                      : isDelayed
                      ? "border-amber-600 bg-amber-50 text-amber-700"
                      : "border-slate-300 text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3 stroke-[3]" />
                  ) : isInProgress ? (
                    <div className="h-2 w-2 rounded-full bg-blue-600" />
                  ) : (
                    <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                  )}
                </div>

                {/* Milestone Detail Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 hover:border-slate-300 hover:bg-white transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-slate-900">
                        {milestone.milestone_name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        {milestone.target_date && (
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            Target: {new Date(milestone.target_date).toLocaleDateString("en-GB")}
                          </span>
                        )}
                        {milestone.completed_at && (
                          <span className="flex items-center gap-1 text-emerald-700 font-mono font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            Done: {new Date(milestone.completed_at).toLocaleString("en-GB")}
                          </span>
                        )}
                        {milestone.recorderProfile && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            By: {milestone.recorderProfile.full_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge & Fast Transition Controls */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <MilestoneStatusBadge status={milestone.status} size="sm" />

                      {canManageMilestones && isOrderEligible && (
                        <div className="relative">
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          ) : (
                            <select
                              value={milestone.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  milestone.id,
                                  e.target.value as FulfilmentMilestoneStatus
                                )
                              }
                              className="text-[11px] font-semibold rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 shadow-2xs cursor-pointer"
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="delayed">Delayed</option>
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes / Details */}
                  {milestone.notes && (
                    <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 leading-relaxed">
                      {milestone.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Milestone Modal */}
      <AddMilestoneModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        purchaseOrderId={purchaseOrderId}
        orderReference={orderReference}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
