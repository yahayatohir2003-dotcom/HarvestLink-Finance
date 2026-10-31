/**
 * HarvestLink Finance - Financing Request Domain Types & Constants
 *
 * Strict TypeScript types reflecting PostgreSQL schema constraints for:
 * - financing_requests
 * - financing_reviews
 */

import { PurchaseOrderRecord } from "./purchase-order";
import { DocumentRecord } from "./document";

/**
 * Permitted status values for financing_requests
 * Strictly enforced by PostgreSQL constraint: financing_requests_status_check
 */
export type FinancingRequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "declined"
  | "withdrawn";

/**
 * Permitted decision values for financing_reviews
 * Strictly enforced by PostgreSQL constraint: financing_reviews_decision_check
 */
export type FinancingReviewDecision = "approved" | "declined";

/**
 * Database record interface for financing_requests (9 columns)
 */
export interface FinancingRequestRecord {
  id: string;
  purchase_order_id: string;
  requested_by: string;
  requested_amount: number;
  purpose: string;
  status: FinancingRequestStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Enriched financing request with linked PO and requester profile
 */
export interface EnrichedFinancingRequest extends FinancingRequestRecord {
  purchaseOrder?: {
    id: string;
    order_reference: string;
    total_amount: number;
    status: string;
    buyerOrganization?: {
      id: string;
      name: string;
    };
    supplierOrganization?: {
      id: string;
      name: string;
    };
    items?: Array<{
      item_name: string;
      quantity: number;
      unit: string;
      unit_price: number;
      line_total: number;
    }>;
  };
  requester?: {
    id: string;
    full_name: string;
    role: string;
    organization_name?: string;
  };
  reviews?: FinancingReviewRecord[];
  documents?: DocumentRecord[];
}

/**
 * Database record interface for financing_reviews (6 columns)
 */
export interface FinancingReviewRecord {
  id: string;
  financing_request_id: string;
  reviewer_id: string;
  decision: FinancingReviewDecision;
  comments: string | null;
  reviewed_at: string;
  reviewerProfile?: {
    id: string;
    full_name: string;
    role: string;
  };
}

/**
 * Payload for creating or updating a financing request
 */
export interface CreateFinancingRequestInput {
  purchase_order_id: string;
  requested_amount: number;
  purpose: string;
  status?: "draft" | "submitted";
}

/**
 * Payload for recording an institutional underwriting review decision
 */
export interface SubmitReviewDecisionInput {
  financing_request_id: string;
  decision: FinancingReviewDecision;
  comments?: string;
}

/**
 * Status styling and visual configuration
 */
export interface FinancingStatusConfig {
  label: string;
  badgeClass: string;
  description: string;
}

export const FINANCING_STATUS_CONFIGS: Record<FinancingRequestStatus, FinancingStatusConfig> = {
  draft: {
    label: "Draft",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    description: "Application saved as draft, not yet submitted for review.",
  },
  submitted: {
    label: "Submitted",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    description: "Application submitted and queued for institutional credit review.",
  },
  under_review: {
    label: "Under Review",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    description: "Application is actively being assessed by credit underwriters.",
  },
  approved: {
    label: "Approved",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    description: "Financing approved by the financing institution.",
  },
  declined: {
    label: "Declined",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    description: "Financing declined by the credit committee.",
  },
  withdrawn: {
    label: "Withdrawn",
    badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-300",
    description: "Application was withdrawn by the supplier prior to decision.",
  },
};

/**
 * Maximum financing ratio (standard trade finance policy: up to 100% of confirmed PO value)
 */
export const MAX_FINANCING_RATIO = 1.0;
