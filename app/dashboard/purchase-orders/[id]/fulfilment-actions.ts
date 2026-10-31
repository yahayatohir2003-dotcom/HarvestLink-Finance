"use server";

/**
 * HarvestLink Finance - Fulfilment & Delivery Confirmation Server Actions
 *
 * Server-side operations strictly enforcing role permissions, counterparty
 * boundaries, and database check constraints for:
 * - fulfilment_milestones
 * - delivery_confirmations
 * - purchase_orders (status transition to 'fulfilled')
 * - audit_logs
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CreateMilestoneInput,
  UpdateMilestoneStatusInput,
  SubmitDeliveryConfirmationInput,
  FulfilmentMilestoneStatus,
  DeliveryConfirmationStatus,
} from "@/types/fulfilment";

export interface FulfilmentActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Server Action: Create a new Fulfilment Milestone
 *
 * Rules:
 * 1. Supplier counterparty (or admin) only.
 * 2. Purchase order must be in confirmed ('accepted') state.
 * 3. Permitted statuses: 'pending', 'in_progress', 'completed', 'delayed'.
 * 4. Strictly 9 schema columns in 'fulfilment_milestones'.
 * 5. Logs audit event in 'audit_logs'.
 */
export async function createMilestoneAction(
  input: CreateMilestoneInput
): Promise<FulfilmentActionResult<{ milestoneId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to log milestones." };
    }

    // 1. Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: "User profile not found." };
    }

    const admin = createAdminClient();

    // 2. Query target purchase order
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("id, order_reference, status, supplier_organization_id, buyer_organization_id")
      .eq("id", input.purchase_order_id)
      .maybeSingle();

    if (poErr || !po) {
      return { success: false, message: "Purchase order not found." };
    }

    // 3. Counterparty Authorization: Supplier organisation or admin only
    const isSupplier = profile.organization_id === po.supplier_organization_id;
    const isAdmin = profile.role === "admin";

    if (!isSupplier && !isAdmin) {
      return {
        success: false,
        message: "Unauthorized: Only the designated supplier or an administrator can record fulfilment milestones.",
      };
    }

    // 4. Verify Purchase Order status eligibility
    // Fulfilment can only be tracked for confirmed trade contracts
    if (po.status !== "accepted" && po.status !== "fulfilled") {
      return {
        success: false,
        message: `Purchase order '${po.order_reference}' is in '${po.status}' state. Fulfilment milestones can only be logged for confirmed (accepted) orders.`,
      };
    }

    // 5. Validate milestone name
    const milestoneName = input.milestone_name?.trim();
    if (!milestoneName) {
      return { success: false, message: "Milestone name is required." };
    }

    // 6. Validate status against check constraint 'fulfilment_milestones_status_check'
    const status: FulfilmentMilestoneStatus = input.status || "pending";
    const allowedStatuses: FulfilmentMilestoneStatus[] = ["pending", "in_progress", "completed", "delayed"];
    if (!allowedStatuses.includes(status)) {
      return {
        success: false,
        message: `Invalid milestone status '${status}'. Permitted values: ${allowedStatuses.join(", ")}.`,
      };
    }

    const nowIso = new Date().toISOString();
    const completedAt = status === "completed" ? nowIso : null;
    const targetDate = input.target_date?.trim() || null;
    const notes = input.notes?.trim() || null;

    // 7. Insert milestone (strictly 9 schema columns)
    const { data: inserted, error: insErr } = await admin
      .from("fulfilment_milestones")
      .insert({
        purchase_order_id: po.id,
        milestone_name: milestoneName,
        status: status,
        notes: notes,
        target_date: targetDate,
        completed_at: completedAt,
        recorded_by: user.id,
        created_at: nowIso,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return { success: false, message: `Failed to create milestone: ${insErr?.message}` };
    }

    // 8. Log audit trail
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "FULFILMENT_MILESTONE_CREATED",
      entity_table: "fulfilment_milestones",
      entity_id: inserted.id,
      details: {
        purchase_order_id: po.id,
        order_reference: po.order_reference,
        milestone_name: milestoneName,
        status: status,
        target_date: targetDate,
        recorded_by_name: profile.full_name || user.email,
      },
      created_at: nowIso,
    });

    revalidatePath(`/dashboard/purchase-orders/${po.id}`);
    revalidatePath("/dashboard/supplier");

    return {
      success: true,
      message: `Fulfilment milestone '${milestoneName}' logged successfully.`,
      data: { milestoneId: inserted.id },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record milestone.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Update the Status of a Fulfilment Milestone
 *
 * Rules:
 * 1. Supplier counterparty (or admin) only.
 * 2. Permitted statuses: 'pending', 'in_progress', 'completed', 'delayed'.
 * 3. Automatically populates 'completed_at' when transitioning to 'completed'.
 * 4. Logs audit event in 'audit_logs'.
 */
export async function updateMilestoneStatusAction(
  input: UpdateMilestoneStatusInput
): Promise<FulfilmentActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required." };
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

    // 1. Query target milestone
    const { data: milestone, error: mErr } = await admin
      .from("fulfilment_milestones")
      .select("id, purchase_order_id, milestone_name, status, completed_at")
      .eq("id", input.milestone_id)
      .maybeSingle();

    if (mErr || !milestone) {
      return { success: false, message: "Fulfilment milestone not found." };
    }

    // 2. Query linked purchase order for authorization
    const { data: po } = await admin
      .from("purchase_orders")
      .select("id, order_reference, status, supplier_organization_id")
      .eq("id", milestone.purchase_order_id)
      .maybeSingle();

    if (!po) {
      return { success: false, message: "Linked purchase order not found." };
    }

    const isSupplier = profile.organization_id === po.supplier_organization_id;
    const isAdmin = profile.role === "admin";

    if (!isSupplier && !isAdmin) {
      return {
        success: false,
        message: "Unauthorized: Only the designated supplier or administrator can update milestone statuses.",
      };
    }

    // 3. Validate new status
    const allowedStatuses: FulfilmentMilestoneStatus[] = ["pending", "in_progress", "completed", "delayed"];
    if (!allowedStatuses.includes(input.status)) {
      return {
        success: false,
        message: `Invalid milestone status '${input.status}'. Permitted: ${allowedStatuses.join(", ")}.`,
      };
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status: input.status,
    };

    if (input.notes !== undefined) {
      updatePayload.notes = input.notes?.trim() || null;
    }

    if (input.status === "completed") {
      updatePayload.completed_at = milestone.completed_at || nowIso;
    } else if (milestone.completed_at) {
      // Reverted from completed back to pending, in_progress, or delayed
      updatePayload.completed_at = null;
    }

    // 4. Update milestone
    const { error: updErr } = await admin
      .from("fulfilment_milestones")
      .update(updatePayload)
      .eq("id", milestone.id);

    if (updErr) {
      return { success: false, message: `Failed to update milestone: ${updErr.message}` };
    }

    // 5. Log audit event
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "FULFILMENT_MILESTONE_UPDATED",
      entity_table: "fulfilment_milestones",
      entity_id: milestone.id,
      details: {
        purchase_order_id: po.id,
        order_reference: po.order_reference,
        milestone_name: milestone.milestone_name,
        previous_status: milestone.status,
        new_status: input.status,
        updated_by: profile.full_name || user.email,
      },
      created_at: nowIso,
    });

    revalidatePath(`/dashboard/purchase-orders/${po.id}`);
    revalidatePath("/dashboard/supplier");

    return {
      success: true,
      message: `Milestone status updated to '${input.status}'.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update milestone status.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Submit Delivery Confirmation or Dispute
 *
 * Rules:
 * 1. Buyer counterparty (or admin) only.
 * 2. Purchase order must be confirmed ('accepted').
 * 3. Outcome must be 'confirmed' or 'disputed'.
 * 4. Prevents duplicate / conflicting confirmations.
 * 5. If 'confirmed', automatically updates 'purchase_orders.status' to 'fulfilled'.
 * 6. Strictly 10 schema columns in 'delivery_confirmations'.
 * 7. Records audit trail in 'audit_logs'.
 */
export async function submitDeliveryConfirmationAction(
  input: SubmitDeliveryConfirmationInput
): Promise<FulfilmentActionResult<{ confirmationId: string; newOrderStatus?: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to confirm delivery." };
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
      .select("id, order_reference, status, buyer_organization_id, supplier_organization_id, total_amount")
      .eq("id", input.purchase_order_id)
      .maybeSingle();

    if (poErr || !po) {
      return { success: false, message: "Purchase order not found." };
    }

    // 2. Counterparty Authorization: Buyer organisation or admin only
    const isBuyer = profile.organization_id === po.buyer_organization_id;
    const isAdmin = profile.role === "admin";

    if (!isBuyer && !isAdmin) {
      return {
        success: false,
        message: "Unauthorized: Only the authorized receiving buyer organization or an administrator can confirm delivery.",
      };
    }

    // 3. Verify Purchase Order status eligibility
    if (po.status !== "accepted" && po.status !== "fulfilled") {
      return {
        success: false,
        message: `Cannot record delivery: Purchase order is in '${po.status}' state. Deliveries can only be confirmed for accepted orders.`,
      };
    }

    // 4. Duplicate / Conflicting Confirmation Guard
    // Check if an existing confirmed delivery is already on file
    const { data: existingConfirmations } = await admin
      .from("delivery_confirmations")
      .select("id, status, delivery_date")
      .eq("purchase_order_id", po.id);

    const alreadyConfirmed = (existingConfirmations || []).find((c) => c.status === "confirmed");
    if (alreadyConfirmed) {
      return {
        success: false,
        message: `Delivery has already been formally confirmed on this order (${new Date(alreadyConfirmed.delivery_date).toLocaleDateString()}). Conflicting confirmations are blocked.`,
      };
    }

    // 5. Validate status input against check constraint 'delivery_confirmations_status_check'
    const status: DeliveryConfirmationStatus = input.status;
    if (status !== "confirmed" && status !== "disputed") {
      return {
        success: false,
        message: "Invalid outcome. Delivery confirmation must be 'confirmed' or 'disputed'.",
      };
    }

    // 6. Validate receiving officer name
    const receivedByName = input.received_by_name?.trim();
    if (!receivedByName) {
      return {
        success: false,
        message: "Receiving officer name / intake manager name is required.",
      };
    }

    // 7. Validate received quantity
    const quantityReceived = input.quantity_received !== undefined && input.quantity_received !== null
      ? Number(input.quantity_received)
      : null;

    if (quantityReceived !== null && (isNaN(quantityReceived) || quantityReceived < 0)) {
      return {
        success: false,
        message: "Received quantity must be a non-negative number.",
      };
    }

    const nowIso = new Date().toISOString();
    const deliveryDate = input.delivery_date ? new Date(input.delivery_date).toISOString() : nowIso;
    const conditionNotes = input.condition_notes?.trim() || null;
    const evidenceDocId = input.evidence_document_id?.trim() || null;

    // 8. Insert delivery confirmation record (strictly 10 schema columns)
    const { data: insertedConfirmation, error: confErr } = await admin
      .from("delivery_confirmations")
      .insert({
        purchase_order_id: po.id,
        confirmed_by: user.id,
        received_by_name: receivedByName,
        delivery_date: deliveryDate,
        quantity_received: quantityReceived,
        condition_notes: conditionNotes,
        evidence_document_id: evidenceDocId,
        status: status,
        created_at: nowIso,
      })
      .select("id")
      .single();

    if (confErr || !insertedConfirmation) {
      return {
        success: false,
        message: `Failed to record delivery confirmation: ${confErr?.message}`,
      };
    }

    // Concurrency race condition check: if two confirmations were inserted in parallel, rollback duplicate
    const { data: allPoConfirmations } = await admin
      .from("delivery_confirmations")
      .select("id, status, created_at")
      .eq("purchase_order_id", po.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    if (allPoConfirmations && allPoConfirmations.length > 1) {
      const winner = allPoConfirmations[0];
      if (winner.id !== insertedConfirmation.id) {
        // Rollback duplicate confirmation
        await admin.from("delivery_confirmations").delete().eq("id", insertedConfirmation.id);
        return {
          success: false,
          message: "A concurrent delivery confirmation was already submitted for this order.",
        };
      }
    }

    let newOrderStatus = po.status;

    // 9. If delivery is confirmed, transition purchase order status to 'fulfilled'
    if (status === "confirmed") {
      const { error: poUpdErr } = await admin
        .from("purchase_orders")
        .update({
          status: "fulfilled",
          updated_at: nowIso,
        })
        .eq("id", po.id);

      if (!poUpdErr) {
        newOrderStatus = "fulfilled";
      }

      // Log ORDER_FULFILLED
      await admin.from("audit_logs").insert({
        actor_id: user.id,
        action: "ORDER_FULFILLED",
        entity_table: "purchase_orders",
        entity_id: po.id,
        details: {
          order_reference: po.order_reference,
          previous_status: po.status,
          new_status: "fulfilled",
          delivery_confirmation_id: insertedConfirmation.id,
          received_by_name: receivedByName,
          quantity_received: quantityReceived,
          confirmed_by: profile.full_name || user.email,
        },
        created_at: nowIso,
      });
    }

    // 10. Log delivery confirmation / dispute audit trail
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: status === "confirmed" ? "DELIVERY_CONFIRMED" : "DELIVERY_DISPUTED",
      entity_table: "delivery_confirmations",
      entity_id: insertedConfirmation.id,
      details: {
        purchase_order_id: po.id,
        order_reference: po.order_reference,
        status: status,
        received_by_name: receivedByName,
        quantity_received: quantityReceived,
        condition_notes: conditionNotes,
        evidence_document_id: evidenceDocId,
        confirmed_by: profile.full_name || user.email,
      },
      created_at: nowIso,
    });

    revalidatePath(`/dashboard/purchase-orders/${po.id}`);
    revalidatePath("/dashboard/buyer");
    revalidatePath("/dashboard/supplier");

    return {
      success: true,
      message: status === "confirmed"
        ? `Delivery confirmed by ${receivedByName}. Order marked as fulfilled.`
        : `Delivery discrepancy / dispute recorded for order ${po.order_reference}.`,
      data: { confirmationId: insertedConfirmation.id, newOrderStatus },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record delivery confirmation.";
    return { success: false, message: msg };
  }
}
