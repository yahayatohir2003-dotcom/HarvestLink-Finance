/**
 * HarvestLink Finance - Purchase Order Utility Functions
 *
 * Provides helpers for PO reference generation, metadata encoding,
 * status badge styling, and financial calculations.
 */

import { PurchaseOrderStatus } from "@/types/purchase-order";

/**
 * Generate a standard Nigerian agricultural PO reference string.
 * Format: HL-PO-YYYYMMDD-XXXX (e.g. HL-PO-20261030-9482)
 */
export function generatePoReference(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `HL-PO-${year}${month}${day}-${randomSuffix}`;
}

/**
 * Encodes Delivery Address and Transaction Notes into the single
 * existing database column 'purchase_orders.description' (text).
 * This ensures 100% database schema compliance without schema modifications.
 */
export function encodePoDescription(params: {
  deliveryAddress: string;
  notes?: string;
}): string {
  const addressPart = `Delivery Address: ${params.deliveryAddress.trim()}`;
  const notesPart = params.notes?.trim() ? `\n\nNotes: ${params.notes.trim()}` : "";
  return `${addressPart}${notesPart}`;
}

/**
 * Decodes the 'purchase_orders.description' string back into its
 * distinct delivery address and notes components for UI presentation.
 */
export function decodePoDescription(description: string | null | undefined): {
  deliveryAddress: string;
  notes: string;
} {
  if (!description) {
    return { deliveryAddress: "Not specified", notes: "" };
  }

  // Look for structured "Delivery Address:" and "Notes:" markers
  const addressMatch = description.match(/Delivery Address:\s*([\s\S]*?)(?=\n\nNotes:|$)/i);
  const notesMatch = description.match(/Notes:\s*([\s\S]*)$/i);

  const deliveryAddress = addressMatch ? addressMatch[1].trim() : description.trim();
  const notes = notesMatch ? notesMatch[1].trim() : "";

  return {
    deliveryAddress: deliveryAddress || "Not specified",
    notes: notes || "",
  };
}

/**
 * Visual styling and metadata for each Purchase Order status.
 */
export interface StatusBadgeConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
}

export function getStatusBadgeConfig(status: PurchaseOrderStatus | string): StatusBadgeConfig {
  switch (status) {
    case "draft":
      return {
        label: "Draft",
        bgClass: "bg-slate-100",
        textClass: "text-slate-700",
        borderClass: "border-slate-300",
        description: "Draft created by Buyer; not yet submitted to Supplier.",
      };
    case "submitted":
      return {
        label: "Submitted",
        bgClass: "bg-amber-50",
        textClass: "text-amber-800",
        borderClass: "border-amber-300",
        description: "Awaiting review and acceptance by Supplier.",
      };
    case "accepted":
      return {
        label: "Accepted",
        bgClass: "bg-blue-50",
        textClass: "text-blue-800",
        borderClass: "border-blue-300",
        description: "Supplier accepted order; eligible for supply-chain financing.",
      };
    case "fulfilled":
      return {
        label: "Fulfilled",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-800",
        borderClass: "border-emerald-300",
        description: "Commodities physically delivered and verified.",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        bgClass: "bg-rose-50",
        textClass: "text-rose-800",
        borderClass: "border-rose-300",
        description: "Order cancelled by Buyer or mutual agreement.",
      };
    case "rejected":
      return {
        label: "Rejected",
        bgClass: "bg-red-50",
        textClass: "text-red-800",
        borderClass: "border-red-300",
        description: "Supplier declined order due to capacity or pricing.",
      };
    default:
      return {
        label: status || "Unknown",
        bgClass: "bg-slate-100",
        textClass: "text-slate-700",
        borderClass: "border-slate-300",
        description: "Status pending update.",
      };
  }
}

/**
 * Calculates line total given quantity and unit price.
 */
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  if (isNaN(quantity) || isNaN(unitPrice) || quantity < 0 || unitPrice < 0) {
    return 0;
  }
  return Math.round(quantity * unitPrice * 100) / 100;
}

/**
 * Calculates grand total of an array of line items.
 */
export function calculateOrderTotal(
  items: Array<{ quantity: number; unitPrice: number } | { lineTotal: number }>
): number {
  return items.reduce((acc, item) => {
    if ("lineTotal" in item && typeof item.lineTotal === "number") {
      return acc + (item.lineTotal || 0);
    }
    const q = (item as { quantity: number; unitPrice: number }).quantity || 0;
    const p = (item as { quantity: number; unitPrice: number }).unitPrice || 0;
    return acc + calculateLineTotal(q, p);
  }, 0);
}
