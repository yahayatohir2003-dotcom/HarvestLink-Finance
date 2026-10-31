/**
 * HarvestLink Finance - Invoice Management Domain Types
 *
 * Defines contracts, statuses, configurations, and input schemas for
 * agricultural invoice processing and trade settlement tracking.
 *
 * Strictly adheres to Supabase 'invoices' and 'settlements' table schemas
 * and check constraints without inventing columns.
 */

import { PurchaseOrderStatus } from "./purchase-order";
import { DocumentRecord } from "./document";

/**
 * Permitted status values enforced by database check constraint:
 * 'invoices_status_check' = ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')
 */
export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

/**
 * Permitted status values enforced by database check constraint:
 * 'settlements_status_check' = ('pending', 'failed', 'cancelled', 'paid')
 */
export type SettlementStatus =
  | "pending"
  | "failed"
  | "cancelled"
  | "paid";

/**
 * Exact representation of a row in the Supabase 'invoices' table.
 * Exactly 8 columns.
 */
export interface InvoiceRecord {
  id: string;
  purchase_order_id: string;
  invoice_number: string;
  amount: number;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  created_at: string;
}

/**
 * Exact representation of a row in the Supabase 'settlements' table.
 * Exactly 11 columns.
 */
export interface SettlementRecord {
  id: string;
  purchase_order_id: string;
  invoice_id: string | null;
  amount: number;
  status: SettlementStatus;
  payment_reference: string | null;
  is_simulated: boolean;
  notes: string | null;
  recorded_by: string | null;
  settled_at: string | null;
  created_at: string;
}

/**
 * Enriched invoice record with joined purchase order, counterparty
 * organizations, and settlements metadata for presentation.
 */
export interface EnrichedInvoiceRecord extends InvoiceRecord {
  purchaseOrder?: {
    id: string;
    order_reference: string;
    total_amount: number;
    status: PurchaseOrderStatus;
    buyer_organization_id: string;
    supplier_organization_id: string;
    buyerOrgName?: string;
    supplierOrgName?: string;
  };
  settlements?: SettlementRecord[];
  supportingDocuments?: DocumentRecord[];
}

/**
 * Payload for creating a new invoice.
 */
export interface CreateInvoiceInput {
  purchase_order_id: string;
  invoice_number: string;
  amount: number;
  issue_date?: string;
  due_date?: string | null;
  status?: "draft" | "issued";
}

/**
 * Payload for updating invoice status.
 */
export interface UpdateInvoiceStatusInput {
  invoice_id: string;
  status: InvoiceStatus;
  reason?: string;
}

/**
 * Payload for recording non-custodial settlement coordination.
 */
export interface RecordSettlementInput {
  purchase_order_id: string;
  invoice_id?: string | null;
  amount: number;
  payment_reference?: string | null;
  notes?: string | null;
  status?: SettlementStatus;
  is_simulated?: boolean;
}

/**
 * Payload for institutional reviewer / administrator reconciling an external settlement claim.
 */
export interface ReconcileSettlementInput {
  settlement_id: string;
  decision: "verify" | "reject";
  review_notes?: string | null;
}

/**
 * Reconciled balance summary for an invoice.
 * Purely derived from existing invoice and settlement records without inventing columns.
 */
export interface InvoiceReconciliationSummary {
  totalInvoiced: number;
  reconciledPaid: number;
  pendingClaims: number;
  simulatedTotal: number;
  remainingBalance: number;
  reconciliationState: "unsettled" | "partially_paid" | "fully_settled" | "overdue" | "cancelled";
  reconciledCount: number;
  pendingCount: number;
  simulatedCount: number;
  failedCount: number;
  percentSettled: number;
}

/**
 * Pure calculation function to determine the reconciled financial balance of an invoice.
 *
 * Rules:
 * 1. Only settlements with status === 'paid' AND is_simulated === false count toward reconciled paid.
 * 2. Settlements with is_simulated === true are tracked in simulatedTotal and DO NOT decrement balance.
 * 3. Settlements with status === 'pending' are unverified external claims.
 * 4. Settlements with status === 'failed' or 'cancelled' are disregarded from active balances.
 */
export function calculateInvoiceReconciliation(
  invoiceAmount: number,
  invoiceStatus: InvoiceStatus,
  settlements: SettlementRecord[] = []
): InvoiceReconciliationSummary {
  let reconciledPaid = 0;
  let pendingClaims = 0;
  let simulatedTotal = 0;
  let reconciledCount = 0;
  let pendingCount = 0;
  let simulatedCount = 0;
  let failedCount = 0;

  for (const s of settlements) {
    const amt = Number(s.amount) || 0;
    if (s.is_simulated) {
      simulatedTotal += amt;
      simulatedCount++;
    } else {
      if (s.status === "paid") {
        reconciledPaid += amt;
        reconciledCount++;
      } else if (s.status === "pending") {
        pendingClaims += amt;
        pendingCount++;
      } else if (s.status === "failed" || s.status === "cancelled") {
        failedCount++;
      }
    }
  }

  const remainingBalance = Math.max(0, invoiceAmount - reconciledPaid);
  const percentSettled = invoiceAmount > 0 ? Math.min(100, Math.round((reconciledPaid / invoiceAmount) * 100)) : 0;

  let reconciliationState: InvoiceReconciliationSummary["reconciliationState"] = "unsettled";
  if (invoiceStatus === "cancelled") {
    reconciliationState = "cancelled";
  } else if (reconciledPaid >= invoiceAmount && invoiceAmount > 0) {
    reconciliationState = "fully_settled";
  } else if (reconciledPaid > 0) {
    reconciliationState = "partially_paid";
  } else if (invoiceStatus === "overdue") {
    reconciliationState = "overdue";
  }

  return {
    totalInvoiced: invoiceAmount,
    reconciledPaid,
    pendingClaims,
    simulatedTotal,
    remainingBalance,
    reconciliationState,
    reconciledCount,
    pendingCount,
    simulatedCount,
    failedCount,
    percentSettled,
  };
}

/**
 * Visual styling and metadata for invoice statuses.
 */
export interface InvoiceStatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
}

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, InvoiceStatusConfig> = {
  draft: {
    label: "Draft",
    bgClass: "bg-slate-100",
    textClass: "text-slate-700",
    borderClass: "border-slate-300",
    description: "Invoice draft prepared by supplier; not yet formally issued.",
  },
  issued: {
    label: "Issued",
    bgClass: "bg-blue-50",
    textClass: "text-blue-800",
    borderClass: "border-blue-300",
    description: "Invoice officially issued to buyer; awaiting payment settlement.",
  },
  partially_paid: {
    label: "Partially Paid",
    bgClass: "bg-amber-50",
    textClass: "text-amber-800",
    borderClass: "border-amber-300",
    description: "Partial settlement recorded against invoice balance.",
  },
  paid: {
    label: "Paid / Settled",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-800",
    borderClass: "border-emerald-300",
    description: "Invoice settlement fully completed and verified.",
  },
  overdue: {
    label: "Overdue",
    bgClass: "bg-rose-50",
    textClass: "text-rose-800",
    borderClass: "border-rose-300",
    description: "Invoice settlement past specified due date.",
  },
  cancelled: {
    label: "Cancelled / Void",
    bgClass: "bg-slate-100",
    textClass: "text-slate-500",
    borderClass: "border-slate-300",
    description: "Invoice cancelled or superseded prior to settlement.",
  },
};

/**
 * Visual styling and metadata for settlement statuses.
 */
export interface SettlementStatusConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
}

export const SETTLEMENT_STATUS_CONFIG: Record<SettlementStatus, SettlementStatusConfig> = {
  pending: {
    label: "Unverified Claim (Pending)",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-300",
    description: "User-submitted payment reference awaiting independent credit advice or reviewer confirmation.",
  },
  paid: {
    label: "Reconciled / Settled",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-800",
    badgeBorder: "border-emerald-300",
    description: "External bank settlement verified against institutional bank statement.",
  },
  failed: {
    label: "Failed / Rejected",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-800",
    badgeBorder: "border-rose-300",
    description: "Settlement claim rejected or failed bank reconciliation.",
  },
  cancelled: {
    label: "Cancelled",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-600",
    badgeBorder: "border-slate-300",
    description: "Settlement record cancelled or superseded.",
  },
};

/**
 * Generates a unique standard agricultural invoice reference string.
 * Format: HL-INV-YYYYMMDD-XXXX (e.g. HL-INV-20261031-4821)
 */
export function generateInvoiceReference(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `HL-INV-${year}${month}${day}-${randomSuffix}`;
}
