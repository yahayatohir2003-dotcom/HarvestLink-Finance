/**
 * HarvestLink Finance - Fulfilment Tracking & Delivery Confirmation Domain Types
 *
 * Strict TypeScript types reflecting PostgreSQL schema constraints for:
 * - fulfilment_milestones (constraint: fulfilment_milestones_status_check)
 * - delivery_confirmations (constraint: delivery_confirmations_status_check)
 */

import { DocumentRecord } from "./document";

/**
 * Permitted status values for fulfilment_milestones
 * Strictly enforced by PostgreSQL constraint: fulfilment_milestones_status_check
 * Values: 'pending', 'in_progress', 'completed', 'delayed'
 */
export type FulfilmentMilestoneStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "delayed";

/**
 * Permitted status values for delivery_confirmations
 * Strictly enforced by PostgreSQL constraint: delivery_confirmations_status_check
 * Values: 'pending', 'confirmed', 'disputed'
 */
export type DeliveryConfirmationStatus =
  | "pending"
  | "confirmed"
  | "disputed";

/**
 * Database record interface for fulfilment_milestones (9 columns)
 */
export interface FulfilmentMilestoneRecord {
  id: string;
  purchase_order_id: string;
  milestone_name: string;
  status: FulfilmentMilestoneStatus;
  notes: string | null;
  target_date: string | null;
  completed_at: string | null;
  recorded_by: string | null;
  created_at: string;
}

/**
 * Enriched milestone record joined with recorder profile
 */
export interface EnrichedFulfilmentMilestone extends FulfilmentMilestoneRecord {
  recorderProfile?: {
    id: string;
    full_name: string;
    role: string;
  } | null;
}

/**
 * Database record interface for delivery_confirmations (10 columns)
 */
export interface DeliveryConfirmationRecord {
  id: string;
  purchase_order_id: string;
  confirmed_by: string;
  received_by_name: string | null;
  delivery_date: string;
  quantity_received: number | null;
  condition_notes: string | null;
  evidence_document_id: string | null;
  status: DeliveryConfirmationStatus;
  created_at: string;
}

/**
 * Enriched delivery confirmation joined with confirmed_by profile and evidence document
 */
export interface EnrichedDeliveryConfirmation extends DeliveryConfirmationRecord {
  confirmerProfile?: {
    id: string;
    full_name: string;
    role: string;
  } | null;
  evidenceDocument?: DocumentRecord | null;
}

/**
 * Payload for creating a new fulfilment milestone
 */
export interface CreateMilestoneInput {
  purchase_order_id: string;
  milestone_name: string;
  target_date?: string | null;
  notes?: string | null;
  status?: FulfilmentMilestoneStatus;
}

/**
 * Payload for updating milestone status
 */
export interface UpdateMilestoneStatusInput {
  milestone_id: string;
  purchase_order_id: string;
  status: FulfilmentMilestoneStatus;
  notes?: string | null;
}

/**
 * Payload for recording a delivery confirmation / dispute
 */
export interface SubmitDeliveryConfirmationInput {
  purchase_order_id: string;
  received_by_name: string;
  delivery_date?: string;
  quantity_received?: number | null;
  condition_notes?: string | null;
  evidence_document_id?: string | null;
  status: "confirmed" | "disputed";
}

/**
 * Standard Nigerian Agricultural Supply Chain Milestone Presets
 */
export interface MilestonePreset {
  name: string;
  description: string;
  typicalLeadTimeDays: number;
}

export const NIGERIAN_FULFILMENT_MILESTONE_PRESETS: MilestonePreset[] = [
  {
    name: "Commodity Sourcing & Farmgate Aggregation",
    description: "Aggregation of crop harvest from contracted smallholder farming clusters.",
    typicalLeadTimeDays: 7,
  },
  {
    name: "Quality Cleaning, Grading & Bagging",
    description: "Sorting, foreign matter removal, moisture level check, and standardized 50kg/100kg bagging.",
    typicalLeadTimeDays: 4,
  },
  {
    name: "Warehouse Loading & Transit Haulage Dispatch",
    description: "Cargo loaded onto long-haul trucks; waybills and transit haulage insurance issued.",
    typicalLeadTimeDays: 2,
  },
  {
    name: "Interstate Transit / Port Haulage",
    description: "Overland freight en route to destination facility/offloading terminal.",
    typicalLeadTimeDays: 5,
  },
  {
    name: "Arrival at Offloading Terminal / Buyer Silo",
    description: "Trucks queued at buyer mill, processing silo, or warehouse for offloading.",
    typicalLeadTimeDays: 1,
  },
];

/**
 * UI visual mapping for milestone statuses
 */
export const MILESTONE_STATUS_CONFIG: Record<
  FulfilmentMilestoneStatus,
  {
    label: string;
    description: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    dotClass: string;
  }
> = {
  pending: {
    label: "Pending",
    description: "Scheduled milestone awaiting execution",
    bgClass: "bg-slate-100",
    textClass: "text-slate-700",
    borderClass: "border-slate-200",
    dotClass: "bg-slate-400",
  },
  in_progress: {
    label: "In Progress",
    description: "Activity currently underway",
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
    borderClass: "border-blue-200",
    dotClass: "bg-blue-500",
  },
  completed: {
    label: "Completed",
    description: "Milestone successfully accomplished",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  delayed: {
    label: "Delayed",
    description: "Execution obstructed or behind schedule",
    bgClass: "bg-amber-50",
    textClass: "text-amber-800",
    borderClass: "border-amber-200",
    dotClass: "bg-amber-500",
  },
};

/**
 * UI visual mapping for delivery confirmation statuses
 */
export const DELIVERY_STATUS_CONFIG: Record<
  DeliveryConfirmationStatus,
  {
    label: string;
    description: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  pending: {
    label: "Pending Receipt",
    description: "Awaiting physical arrival and buyer intake inspection",
    bgClass: "bg-slate-100",
    textClass: "text-slate-700",
    borderClass: "border-slate-200",
  },
  confirmed: {
    label: "Delivery Confirmed",
    description: "Goods physically received, inspected, and verified by buyer",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-200",
  },
  disputed: {
    label: "Delivery Disputed",
    description: "Discrepancy reported in received quantity or commodity quality",
    bgClass: "bg-rose-50",
    textClass: "text-rose-700",
    borderClass: "border-rose-200",
  },
};
