"use server";

/**
 * HarvestLink Finance - Invoice Management Server Actions
 *
 * Implements server-side business logic, security guards, counterparty
 * boundaries, and database check constraints for:
 * - invoices
 * - settlements (non-custodial trade tracking)
 * - audit_logs
 *
 * HarvestLink coordinates agricultural supply-chain transactions.
 * It does not lend funds from its balance sheet, hold customer money,
 * execute bank transfers, or process real payments.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CreateInvoiceInput,
  UpdateInvoiceStatusInput,
  RecordSettlementInput,
  ReconcileSettlementInput,
  InvoiceStatus,
  SettlementStatus,
} from "@/types/invoice";

export interface InvoiceActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Server Action: Retrieve purchase orders eligible for invoice creation.
 * Returns accepted or fulfilled purchase orders belonging to the user's supplier organisation.
 */
export async function getEligiblePurchaseOrdersForInvoiceAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required.", orders: [] };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: "User profile not found.", orders: [] };
    }

    const isSupplier = profile.role === "supplier";
    const isAdmin = profile.role === "admin";

    if (!isSupplier && !isAdmin) {
      return {
        success: false,
        message: "Only supplier organizations or administrators can issue commercial invoices.",
        orders: [],
      };
    }

    const admin = createAdminClient();

    // Query purchase orders
    let query = admin
      .from("purchase_orders")
      .select("id, order_reference, total_amount, status, created_at, buyer_organization_id, supplier_organization_id")
      .in("status", ["accepted", "fulfilled"])
      .order("created_at", { ascending: false });

    // Restrict to supplier's organisation unless admin
    if (!isAdmin && profile.organization_id) {
      query = query.eq("supplier_organization_id", profile.organization_id);
    }

    const { data: orders, error: poErr } = await query;
    if (poErr) {
      return { success: false, message: poErr.message, orders: [] };
    }

    // Fetch buyer organization names
    const buyerOrgIds = Array.from(new Set((orders || []).map((o) => o.buyer_organization_id)));
    let orgMap: Record<string, string> = {};
    if (buyerOrgIds.length > 0) {
      const { data: orgs } = await admin
        .from("organizations")
        .select("id, name")
        .in("id", buyerOrgIds);
      if (orgs) {
        orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
      }
    }

    // Fetch existing invoices count for each PO
    const poIds = (orders || []).map((o) => o.id);
    let invoiceCountMap: Record<string, number> = {};
    if (poIds.length > 0) {
      const { data: existingInvoices } = await admin
        .from("invoices")
        .select("id, purchase_order_id")
        .in("purchase_order_id", poIds);
      if (existingInvoices) {
        for (const inv of existingInvoices) {
          invoiceCountMap[inv.purchase_order_id] = (invoiceCountMap[inv.purchase_order_id] || 0) + 1;
        }
      }
    }

    const enrichedOrders = (orders || []).map((o) => ({
      ...o,
      buyerName: orgMap[o.buyer_organization_id] || "Corporate Buyer",
      existingInvoicesCount: invoiceCountMap[o.id] || 0,
    }));

    return { success: true, message: "Eligible orders retrieved.", orders: enrichedOrders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load eligible purchase orders.";
    return { success: false, message: msg, orders: [] };
  }
}

/**
 * Server Action: Create a commercial invoice.
 *
 * Rules:
 * 1. Supplier counterparty (or admin) only.
 * 2. Target purchase order must be in 'accepted' or 'fulfilled' status.
 * 3. Amount must be positive (> 0) and <= purchase_orders.total_amount.
 * 4. Invoice number must be unique (enforced by 'invoices_invoice_number_key').
 * 5. Status must be 'draft' or 'issued' (per 'invoices_status_check').
 * 6. Inserts strictly 8 schema columns in 'invoices'.
 * 7. Records audit trail in 'audit_logs'.
 */
export async function createInvoiceAction(
  input: CreateInvoiceInput
): Promise<InvoiceActionResult<{ invoiceId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to create invoices." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: "User profile not found." };
    }

    const admin = createAdminClient();

    // 1. Query target purchase order
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("id, order_reference, status, supplier_organization_id, buyer_organization_id, total_amount")
      .eq("id", input.purchase_order_id)
      .maybeSingle();

    if (poErr || !po) {
      return { success: false, message: "Linked purchase order not found." };
    }

    // 2. Authorization Guard: Supplier organization or Admin only
    const isSupplier = profile.organization_id === po.supplier_organization_id;
    const isAdmin = profile.role === "admin";

    if (!isSupplier && !isAdmin) {
      return {
        success: false,
        message: "Unauthorized: Only the designated supplier organization or an administrator can issue an invoice for this order.",
      };
    }

    // 3. Status Eligibility: Order must be accepted or fulfilled
    if (po.status !== "accepted" && po.status !== "fulfilled") {
      return {
        success: false,
        message: `Invoices can only be issued for confirmed orders. Current order status is '${po.status}'.`,
      };
    }

    // 4. Validate Invoice Number
    const invoiceNumber = input.invoice_number?.trim();
    if (!invoiceNumber) {
      return { success: false, message: "Invoice reference / number is required." };
    }

    // Check duplicate invoice number
    const { data: existingNumber } = await admin
      .from("invoices")
      .select("id, invoice_number")
      .eq("invoice_number", invoiceNumber)
      .maybeSingle();

    if (existingNumber) {
      return {
        success: false,
        message: `Invoice number '${invoiceNumber}' is already registered. Please provide a unique reference.`,
      };
    }

    // 5. Validate Amount
    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return {
        success: false,
        message: "Invoice amount must be a positive number greater than zero.",
      };
    }

    const poTotal = Number(po.total_amount);
    if (amount > poTotal) {
      return {
        success: false,
        message: `Invoice amount (₦${amount.toLocaleString()}) exceeds the total contract value of the purchase order (₦${poTotal.toLocaleString()}).`,
      };
    }

    // 6. Validate Status
    const status: InvoiceStatus = input.status === "draft" ? "draft" : "issued";

    // 7. Validate Dates
    const today = new Date().toISOString().split("T")[0];
    const issueDate = input.issue_date?.trim() || today;
    const dueDate = input.due_date?.trim() || null;

    if (dueDate && new Date(dueDate) < new Date(issueDate)) {
      return {
        success: false,
        message: "Payment due date cannot precede the invoice issue date.",
      };
    }

    const nowIso = new Date().toISOString();

    // 8. Insert Invoice record (strictly 8 schema columns)
    const { data: insertedInvoice, error: insErr } = await admin
      .from("invoices")
      .insert({
        purchase_order_id: po.id,
        invoice_number: invoiceNumber,
        amount: amount,
        issue_date: issueDate,
        due_date: dueDate,
        status: status,
        created_at: nowIso,
      })
      .select("id")
      .single();

    if (insErr || !insertedInvoice) {
      return {
        success: false,
        message: `Failed to create invoice: ${insErr?.message}`,
      };
    }

    // 9. Record Audit Log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "INVOICE_CREATED",
      entity_table: "invoices",
      entity_id: insertedInvoice.id,
      details: {
        purchase_order_id: po.id,
        order_reference: po.order_reference,
        invoice_number: invoiceNumber,
        amount: amount,
        issue_date: issueDate,
        due_date: dueDate,
        status: status,
        issued_by_name: profile.full_name || user.email,
      },
      created_at: nowIso,
    });

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${insertedInvoice.id}`);
    revalidatePath(`/dashboard/purchase-orders/${po.id}`);
    revalidatePath("/dashboard/supplier");
    revalidatePath("/dashboard/buyer");

    return {
      success: true,
      message: status === "issued"
        ? `Commercial invoice ${invoiceNumber} issued successfully for ₦${amount.toLocaleString()}.`
        : `Invoice draft ${invoiceNumber} saved.`,
      data: { invoiceId: insertedInvoice.id },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create invoice.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Update invoice status.
 *
 * Rules:
 * 1. Supplier / Admin: can transition 'draft' -> 'issued', 'draft'/'issued' -> 'cancelled'.
 * 2. Buyer / Financier / Admin: can mark 'paid', 'partially_paid', or 'overdue' with settlement remarks.
 * 3. Enforces PostgreSQL check constraint: 'invoices_status_check'.
 * 4. Records audit log in 'audit_logs'.
 */
export async function updateInvoiceStatusAction(
  input: UpdateInvoiceStatusInput
): Promise<InvoiceActionResult<{ newStatus: InvoiceStatus }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to update invoice status." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: "User profile not found." };
    }

    const admin = createAdminClient();

    // 1. Query Invoice
    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .select("id, purchase_order_id, invoice_number, amount, status")
      .eq("id", input.invoice_id)
      .maybeSingle();

    if (invErr || !invoice) {
      return { success: false, message: "Invoice record not found." };
    }

    // 2. Query linked Purchase Order
    const { data: po } = await admin
      .from("purchase_orders")
      .select("id, order_reference, buyer_organization_id, supplier_organization_id")
      .eq("id", invoice.purchase_order_id)
      .maybeSingle();

    if (!po) {
      return { success: false, message: "Linked purchase order not found." };
    }

    const isSupplier = profile.organization_id === po.supplier_organization_id;
    const isBuyer = profile.organization_id === po.buyer_organization_id;
    const isFinancier = profile.role === "financier";
    const isAdmin = profile.role === "admin";

    if (!isSupplier && !isBuyer && !isFinancier && !isAdmin) {
      return { success: false, message: "Unauthorized to update this invoice." };
    }

    const currentStatus = invoice.status as InvoiceStatus;
    const targetStatus = input.status;

    // Validate against allowed check constraint values
    const allowedStatuses: InvoiceStatus[] = [
      "draft",
      "issued",
      "partially_paid",
      "paid",
      "overdue",
      "cancelled",
    ];
    if (!allowedStatuses.includes(targetStatus)) {
      return {
        success: false,
        message: `Invalid status '${targetStatus}'. Allowed: ${allowedStatuses.join(", ")}.`,
      };
    }

    // Role-specific transition rules
    if (!isAdmin) {
      if (targetStatus === "issued") {
        if (!isSupplier || currentStatus !== "draft") {
          return {
            success: false,
            message: "Only the issuing supplier can issue a draft invoice.",
          };
        }
      } else if (targetStatus === "cancelled") {
        if (!isSupplier) {
          return {
            success: false,
            message: "Only the issuing supplier or administrator can cancel an invoice.",
          };
        }
        if (currentStatus === "paid") {
          return {
            success: false,
            message: "A fully paid/settled invoice cannot be cancelled.",
          };
        }
      } else if (targetStatus === "paid" || targetStatus === "partially_paid") {
        if (!isBuyer && !isFinancier && !isAdmin) {
          return {
            success: false,
            message: "Only the receiving buyer, institutional financier, or administrator can record settlement status.",
          };
        }
      }
    }

    const nowIso = new Date().toISOString();

    // 3. Update Invoice
    const { error: updErr } = await admin
      .from("invoices")
      .update({ status: targetStatus })
      .eq("id", invoice.id);

    if (updErr) {
      return { success: false, message: `Failed to update invoice: ${updErr.message}` };
    }

    // 4. Record Audit Log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "INVOICE_STATUS_UPDATED",
      entity_table: "invoices",
      entity_id: invoice.id,
      details: {
        purchase_order_id: po.id,
        order_reference: po.order_reference,
        invoice_number: invoice.invoice_number,
        previous_status: currentStatus,
        new_status: targetStatus,
        reason: input.reason || null,
        updated_by_name: profile.full_name || user.email,
      },
      created_at: nowIso,
    });

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${invoice.id}`);
    revalidatePath(`/dashboard/purchase-orders/${po.id}`);

    return {
      success: true,
      message: `Invoice ${invoice.invoice_number} status updated to '${targetStatus}'.`,
      data: { newStatus: targetStatus },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update invoice status.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Record non-custodial trade settlement tracking.
 *
 * HarvestLink Scope Boundary:
 * Coordinates trade settlement ledger records; does not hold money,
 * execute bank transfers, or act as a financial intermediary.
 *
 * Enforces:
 * 1. Counterparty access control (buyer, supplier, financier, admin).
 * 2. Invoice eligibility: Must NOT be 'draft' or 'cancelled'.
 * 3. Amount validation: Must be > 0 and <= remaining balance (prevents over-settlement).
 * 4. Duplicate prevention: Checks unique payment_reference and rapid submission debounce.
 * 5. Simulation safety: If is_simulated === true, it is recorded with is_simulated = true
 *    and NEVER decrements real balance or transitions invoice to 'paid'.
 * 6. Non-custodial claims: External buyer/supplier claims are recorded as 'pending'.
 *    Only verified reviewer/financier/admin actions can transition to 'paid'.
 * 7. Decoupled PO status: Full invoice settlement NEVER alters purchase_orders.status.
 */
export async function recordSettlementCoordinationAction(
  input: RecordSettlementInput
): Promise<InvoiceActionResult<{ settlementId: string; invoiceStatus?: InvoiceStatus }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to log settlement tracking." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: "User profile not found." };
    }

    const admin = createAdminClient();

    // 1. Query target purchase order
    const { data: po } = await admin
      .from("purchase_orders")
      .select("id, order_reference, buyer_organization_id, supplier_organization_id, total_amount")
      .eq("id", input.purchase_order_id)
      .maybeSingle();

    if (!po) {
      return { success: false, message: "Purchase order not found." };
    }

    // Counterparty check
    const isBuyer = profile.organization_id === po.buyer_organization_id;
    const isSupplier = profile.organization_id === po.supplier_organization_id;
    const isFinancier = profile.role === "financier";
    const isAdmin = profile.role === "admin";

    if (!isBuyer && !isSupplier && !isFinancier && !isAdmin) {
      return { success: false, message: "Unauthorized: You do not have permissions for this transaction." };
    }

    // 2. Validate Amount
    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: "Settlement amount must be a valid positive number greater than zero." };
    }

    // 3. If linked to an invoice, perform strict validation & balance checks
    let linkedInvoice: { id: string; invoice_number: string; amount: number; status: InvoiceStatus } | null = null;
    let existingReconciledPaid = 0;
    let remainingBalance = Number(po.total_amount);

    if (input.invoice_id) {
      const { data: inv, error: invErr } = await admin
        .from("invoices")
        .select("id, invoice_number, amount, status")
        .eq("id", input.invoice_id)
        .maybeSingle();

      if (invErr || !inv) {
        return { success: false, message: "Linked invoice record not found." };
      }

      linkedInvoice = inv as { id: string; invoice_number: string; amount: number; status: InvoiceStatus };

      // Check invoice status eligibility
      if (linkedInvoice.status === "draft") {
        return {
          success: false,
          message: `Cannot record settlement against a draft invoice (${linkedInvoice.invoice_number}). Please issue the invoice first.`,
        };
      }

      if (linkedInvoice.status === "cancelled") {
        return {
          success: false,
          message: `Cannot record settlement against cancelled or void invoice (${linkedInvoice.invoice_number}).`,
        };
      }

      // Query all existing settlements for this invoice
      const { data: existingSettlements } = await admin
        .from("settlements")
        .select("id, amount, status, is_simulated, payment_reference, recorded_by, created_at")
        .eq("invoice_id", linkedInvoice.id);

      // Sum existing valid reconciled settlements (status === 'paid' AND is_simulated === false)
      existingReconciledPaid = (existingSettlements || [])
        .filter((s) => s.status === "paid" && !s.is_simulated)
        .reduce((sum, s) => sum + Number(s.amount), 0);

      const invAmount = Number(linkedInvoice.amount);
      remainingBalance = Math.max(0, invAmount - existingReconciledPaid);

      // Check for rapid duplicate submission debounce (same user, invoice, amount within 30s)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      const hasRecentDuplicate = (existingSettlements || []).some(
        (s) =>
          s.recorded_by === user.id &&
          Number(s.amount) === amount &&
          new Date(s.created_at) > new Date(thirtySecondsAgo)
      );

      if (hasRecentDuplicate) {
        return {
          success: false,
          message: "A settlement record with this amount was just submitted. Please wait before retrying to prevent duplicate entries.",
        };
      }

      // Over-settlement guard for real claims
      const isSimulatedMode = input.is_simulated === true;
      if (!isSimulatedMode) {
        if (remainingBalance <= 0) {
          return {
            success: false,
            message: `Invoice ${linkedInvoice.invoice_number} is already fully settled (₦${invAmount.toLocaleString()}). Remaining balance is ₦0.`,
          };
        }

        if (amount > remainingBalance) {
          return {
            success: false,
            message: `Settlement amount (₦${amount.toLocaleString()}) exceeds remaining balance (₦${remainingBalance.toLocaleString()}) of invoice ${linkedInvoice.invoice_number}. Over-settlement is prevented.`,
          };
        }
      }
    }

    // 4. Duplicate Payment Reference Check (enforced at DB level, pre-checked here for clean error)
    const paymentRef = input.payment_reference?.trim() || null;
    if (paymentRef) {
      const { data: existingRef } = await admin
        .from("settlements")
        .select("id, payment_reference")
        .eq("payment_reference", paymentRef)
        .maybeSingle();

      if (existingRef) {
        return {
          success: false,
          message: `Payment reference '${paymentRef}' is already registered in the settlement ledger. Duplicate references are rejected.`,
        };
      }
    }

    // 5. Determine Simulation Mode & Settlement Status
    // If input.is_simulated is explicitly true, keep simulation flag true
    const isSimulated = input.is_simulated === true;

    // Settlement status handling:
    // If not simulated, an external claim from a buyer or supplier is submitted as 'pending'
    // Only a financier or administrator can directly certify an external settlement as 'paid'
    let targetStatus: SettlementStatus = input.status || "pending";
    if (!isSimulated) {
      if (!isFinancier && !isAdmin) {
        targetStatus = "pending"; // External counterparty claim remains unverified claim
      }
    }

    const allowedSettlementStatuses: SettlementStatus[] = ["pending", "failed", "cancelled", "paid"];
    if (!allowedSettlementStatuses.includes(targetStatus)) {
      return {
        success: false,
        message: `Invalid settlement status '${targetStatus}'. Permitted: ${allowedSettlementStatuses.join(", ")}.`,
      };
    }

    const nowIso = new Date().toISOString();
    const settledAt = targetStatus === "paid" ? nowIso : null;

    // 6. Insert into 'settlements' table (strictly 11 schema columns)
    const { data: insertedSettlement, error: sErr } = await admin
      .from("settlements")
      .insert({
        purchase_order_id: po.id,
        invoice_id: linkedInvoice?.id || input.invoice_id || null,
        amount: amount,
        status: targetStatus,
        payment_reference: paymentRef,
        is_simulated: isSimulated,
        notes: input.notes?.trim() || null,
        recorded_by: user.id,
        settled_at: settledAt,
        created_at: nowIso,
      })
      .select("id")
      .single();

    if (sErr || !insertedSettlement) {
      return {
        success: false,
        message: `Failed to record settlement: ${sErr?.message}`,
      };
    }

    // 7. Concurrency Serialization & Balance Protection Guard
    // When recording a certified paid settlement against an invoice, re-query all certified settlements
    // chronologically to verify whether a concurrent submission pushed cumulative balance beyond the invoice total.
    let updatedInvoiceStatus: InvoiceStatus | undefined = undefined;

    if (linkedInvoice && targetStatus === "paid" && !isSimulated) {
      const { data: allPaidSettlements } = await admin
        .from("settlements")
        .select("id, amount, created_at")
        .eq("invoice_id", linkedInvoice.id)
        .eq("status", "paid")
        .eq("is_simulated", false)
        .order("created_at", { ascending: true });

      let runningTotal = 0;
      let isExcess = false;
      const invTotal = Number(linkedInvoice.amount);

      for (const s of (allPaidSettlements || [])) {
        runningTotal += Number(s.amount);
        if (s.id === insertedSettlement.id) {
          if (runningTotal > invTotal) {
            isExcess = true;
          }
          break;
        }
      }

      if (isExcess) {
        // Concurrency collision detected: Another transaction already claimed the balance
        await admin
          .from("settlements")
          .update({
            status: "failed",
            notes: "Concurrency conflict: Simultaneous settlement submission exceeded invoice remaining balance. Automatically rejected to prevent over-settlement.",
            settled_at: null,
          })
          .eq("id", insertedSettlement.id);

        await admin.from("audit_logs").insert({
          actor_id: user.id,
          action: "SETTLEMENT_OVERPAYMENT_BLOCKED",
          entity_table: "settlements",
          entity_id: insertedSettlement.id,
          details: {
            invoice_id: linkedInvoice.id,
            attempted_amount: amount,
            invoice_amount: invTotal,
            running_total_at_submission: runningTotal,
            reason: "Concurrent settlement submission exceeded invoice remaining balance.",
          },
          created_at: nowIso,
        });

        return {
          success: false,
          message: `Concurrent settlement conflict: Another transaction consumed the remaining balance. Settlement for ₦${amount.toLocaleString()} was rejected to prevent overpayment.`,
        };
      }

      // Valid settlement within balance limit: proceed to reconcile invoice status
      const newStatus: InvoiceStatus = runningTotal >= invTotal ? "paid" : "partially_paid";

      if (newStatus !== linkedInvoice.status) {
        await admin
          .from("invoices")
          .update({ status: newStatus })
          .eq("id", linkedInvoice.id);

        updatedInvoiceStatus = newStatus;

        // Audit log for invoice status shift
        await admin.from("audit_logs").insert({
          actor_id: user.id,
          action: "INVOICE_STATUS_UPDATED",
          entity_table: "invoices",
          entity_id: linkedInvoice.id,
          details: {
            purchase_order_id: po.id,
            previous_status: linkedInvoice.status,
            new_status: newStatus,
            settlement_id: insertedSettlement.id,
            reconciled_paid_total: runningTotal,
            invoice_total: invTotal,
            reason: `Reconciled external settlement recorded: ${paymentRef || "Direct advice"}`,
          },
          created_at: nowIso,
        });
      }
    }

    // 8. Record Settlement Audit Log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "SETTLEMENT_RECORDED",
      entity_table: "settlements",
      entity_id: insertedSettlement.id,
      details: {
        purchase_order_id: po.id,
        order_reference: po.order_reference,
        invoice_id: linkedInvoice?.id || input.invoice_id || null,
        invoice_number: linkedInvoice?.invoice_number || null,
        amount: amount,
        status: targetStatus,
        payment_reference: paymentRef,
        is_simulated: isSimulated,
        recorded_by_name: profile.full_name || user.email,
        coordination_notice: isSimulated
          ? "Simulated settlement — not proof of payment."
          : targetStatus === "pending"
          ? "Unverified external payment claim submitted."
          : "Verified bank settlement reconciled.",
      },
      created_at: nowIso,
    });

    revalidatePath("/dashboard/invoices");
    if (linkedInvoice?.id) {
      revalidatePath(`/dashboard/invoices/${linkedInvoice.id}`);
    }
    revalidatePath(`/dashboard/purchase-orders/${po.id}`);

    const feedbackMessage = isSimulated
      ? `Simulated coordination record logged for ₦${amount.toLocaleString()} (Simulated — not proof of payment).`
      : targetStatus === "pending"
      ? `Payment claim logged for ₦${amount.toLocaleString()} (Pending verification by reviewer/financier).`
      : `Verified settlement reconciled for ₦${amount.toLocaleString()} against invoice balance.`;

    return {
      success: true,
      message: feedbackMessage,
      data: { settlementId: insertedSettlement.id, invoiceStatus: updatedInvoiceStatus },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record settlement.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Institutional Reviewer / Administrator Reconciles an External Settlement Claim.
 *
 * Rules:
 * 1. Restricted to 'financier' or 'admin' roles.
 * 2. Simulated settlement records cannot be certified as real payments.
 * 3. Enforces over-settlement bounds before marking as 'paid'.
 * 4. Recalculates invoice balance cumulatively and updates invoice status atomically.
 * 5. Logs audit history in 'audit_logs'.
 * 6. Purchase order status is never modified.
 */
export async function reconcileSettlementAction(
  input: ReconcileSettlementInput
): Promise<InvoiceActionResult<{ settlementId: string; newStatus: SettlementStatus; invoiceStatus?: InvoiceStatus }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to reconcile settlements." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: "User profile not found." };
    }

    // Role Guard: Financier or Admin only
    const isFinancier = profile.role === "financier";
    const isAdmin = profile.role === "admin";

    if (!isFinancier && !isAdmin) {
      return {
        success: false,
        message: "Unauthorized: Only institutional financiers or platform administrators can verify settlement claims.",
      };
    }

    const admin = createAdminClient();

    // 1. Query target settlement
    const { data: settlement, error: sErr } = await admin
      .from("settlements")
      .select("*")
      .eq("id", input.settlement_id)
      .maybeSingle();

    if (sErr || !settlement) {
      return { success: false, message: "Settlement record not found." };
    }

    // Guard: Simulated records cannot be reconciled as real payments
    if (settlement.is_simulated) {
      return {
        success: false,
        message: "Cannot verify a simulated settlement record. Simulations are for testing and do not represent bank transfers.",
      };
    }

    const nowIso = new Date().toISOString();

    // 2. Handle Decision: REJECT
    if (input.decision === "reject") {
      const { error: rejErr } = await admin
        .from("settlements")
        .update({
          status: "failed",
          notes: input.review_notes?.trim()
            ? `${settlement.notes ? settlement.notes + " | " : ""}Reconciliation Rejected: ${input.review_notes.trim()}`
            : settlement.notes,
        })
        .eq("id", settlement.id);

      if (rejErr) {
        return { success: false, message: `Failed to reject settlement: ${rejErr.message}` };
      }

      // Audit log
      await admin.from("audit_logs").insert({
        actor_id: user.id,
        action: "SETTLEMENT_REJECTED",
        entity_table: "settlements",
        entity_id: settlement.id,
        details: {
          purchase_order_id: settlement.purchase_order_id,
          invoice_id: settlement.invoice_id,
          amount: settlement.amount,
          previous_status: settlement.status,
          new_status: "failed",
          reason: input.review_notes || "Rejected by reviewer",
          reviewed_by: profile.full_name || user.email,
        },
        created_at: nowIso,
      });

      revalidatePath("/dashboard/invoices");
      if (settlement.invoice_id) revalidatePath(`/dashboard/invoices/${settlement.invoice_id}`);
      revalidatePath(`/dashboard/purchase-orders/${settlement.purchase_order_id}`);

      return {
        success: true,
        message: "Settlement claim rejected and marked as failed.",
        data: { settlementId: settlement.id, newStatus: "failed" },
      };
    }

    // 3. Handle Decision: VERIFY
    if (settlement.status === "paid") {
      return { success: true, message: "Settlement is already verified as paid.", data: { settlementId: settlement.id, newStatus: "paid" } };
    }

    let updatedInvoiceStatus: InvoiceStatus | undefined = undefined;

    // Check linked invoice and calculate balances
    if (settlement.invoice_id) {
      const { data: inv } = await admin
        .from("invoices")
        .select("id, invoice_number, amount, status")
        .eq("id", settlement.invoice_id)
        .maybeSingle();

      if (!inv) {
        return { success: false, message: "Linked invoice record not found." };
      }

      // Query other settlements for this invoice (excluding this one)
      const { data: otherSettlements } = await admin
        .from("settlements")
        .select("id, amount, status, is_simulated")
        .eq("invoice_id", inv.id)
        .neq("id", settlement.id);

      const otherPaidTotal = (otherSettlements || [])
        .filter((s) => s.status === "paid" && !s.is_simulated)
        .reduce((sum, s) => sum + Number(s.amount), 0);

      const newReconciledPaid = otherPaidTotal + Number(settlement.amount);
      const invTotal = Number(inv.amount);

      // Over-settlement guard
      if (newReconciledPaid > invTotal) {
        return {
          success: false,
          message: `Reconciling this settlement (₦${Number(settlement.amount).toLocaleString()}) would exceed the invoice face value (₦${invTotal.toLocaleString()}) by ₦${(newReconciledPaid - invTotal).toLocaleString()}.`,
        };
      }

      // 1. Update settlement record to 'paid' first
      const { error: updErr } = await admin
        .from("settlements")
        .update({
          status: "paid",
          settled_at: nowIso,
          notes: input.review_notes?.trim()
            ? `${settlement.notes ? settlement.notes + " | " : ""}Verified: ${input.review_notes.trim()}`
            : settlement.notes,
        })
        .eq("id", settlement.id);

      if (updErr) {
        return { success: false, message: `Failed to verify settlement: ${updErr.message}` };
      }

      // 2. Concurrency Serialization Guard: verify running cumulative total after update
      const { data: allPaidSettlements } = await admin
        .from("settlements")
        .select("id, amount, created_at")
        .eq("invoice_id", inv.id)
        .eq("status", "paid")
        .eq("is_simulated", false)
        .order("created_at", { ascending: true });

      let runningTotal = 0;
      let isExcess = false;
      for (const s of (allPaidSettlements || [])) {
        runningTotal += Number(s.amount);
        if (s.id === settlement.id) {
          if (runningTotal > invTotal) {
            isExcess = true;
          }
          break;
        }
      }

      if (isExcess) {
        // Concurrency rollback: revert to pending
        await admin
          .from("settlements")
          .update({
            status: "pending",
            settled_at: null,
            notes: `${settlement.notes ? settlement.notes + " | " : ""}Verification conflict: Concurrent verification exceeded invoice balance. Reverted to pending.`,
          })
          .eq("id", settlement.id);

        return {
          success: false,
          message: `Concurrent reconciliation conflict: Another settlement was verified concurrently. Reconciling this claim would exceed invoice balance (₦${invTotal.toLocaleString()}).`,
        };
      }

      // 3. Determine and update invoice status based on verified running total
      const newStatus: InvoiceStatus = runningTotal >= invTotal ? "paid" : "partially_paid";

      if (newStatus !== inv.status) {
        await admin
          .from("invoices")
          .update({ status: newStatus })
          .eq("id", inv.id);

        updatedInvoiceStatus = newStatus;

        await admin.from("audit_logs").insert({
          actor_id: user.id,
          action: "INVOICE_STATUS_UPDATED",
          entity_table: "invoices",
          entity_id: inv.id,
          details: {
            purchase_order_id: settlement.purchase_order_id,
            previous_status: inv.status,
            new_status: newStatus,
            settlement_id: settlement.id,
            reconciled_paid_total: runningTotal,
            invoice_total: invTotal,
            reason: `Settlement verified by reviewer (${profile.full_name || user.email})`,
          },
          created_at: nowIso,
        });
      }
    } else {
      // Settlement not linked to invoice: directly update to 'paid'
      const { error: updErr } = await admin
        .from("settlements")
        .update({
          status: "paid",
          settled_at: nowIso,
          notes: input.review_notes?.trim()
            ? `${settlement.notes ? settlement.notes + " | " : ""}Verified: ${input.review_notes.trim()}`
            : settlement.notes,
        })
        .eq("id", settlement.id);

      if (updErr) {
        return { success: false, message: `Failed to verify settlement: ${updErr.message}` };
      }
    }

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "SETTLEMENT_RECONCILED",
      entity_table: "settlements",
      entity_id: settlement.id,
      details: {
        purchase_order_id: settlement.purchase_order_id,
        invoice_id: settlement.invoice_id,
        amount: settlement.amount,
        payment_reference: settlement.payment_reference,
        new_status: "paid",
        reviewed_by: profile.full_name || user.email,
        review_notes: input.review_notes || "Verified against credit advice",
      },
      created_at: nowIso,
    });

    revalidatePath("/dashboard/invoices");
    if (settlement.invoice_id) revalidatePath(`/dashboard/invoices/${settlement.invoice_id}`);
    revalidatePath(`/dashboard/purchase-orders/${settlement.purchase_order_id}`);

    return {
      success: true,
      message: `Settlement of ₦${Number(settlement.amount).toLocaleString()} verified and reconciled successfully.`,
      data: { settlementId: settlement.id, newStatus: "paid", invoiceStatus: updatedInvoiceStatus },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reconcile settlement.";
    return { success: false, message: msg };
  }
}
