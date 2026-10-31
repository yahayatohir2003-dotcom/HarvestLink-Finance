"use server";

/**
 * HarvestLink Finance - Financing Request Server Actions
 *
 * Implements server-side application submission, eligibility checks,
 * duplicate prevention, institutional underwriting reviews, status transitions,
 * and immutable audit trail logging.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CreateFinancingRequestInput,
  SubmitReviewDecisionInput,
  FinancingRequestStatus,
  FinancingReviewDecision,
} from "@/types/financing";

export interface FinancingActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Server Action: Retrieve purchase orders eligible for financing for the current supplier.
 * A purchase order is eligible if:
 * 1. It belongs to the supplier's organisation.
 * 2. It is in an active/confirmed state ('submitted' or 'accepted').
 * 3. It does not already have an active financing request ('submitted', 'under_review', 'approved').
 */
export async function getEligiblePurchaseOrdersAction(): Promise<
  FinancingActionResult<
    Array<{
      id: string;
      order_reference: string;
      total_amount: number;
      status: string;
      issue_date: string;
      buyer_name: string;
      item_count: number;
    }>
  >
> {
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
      .select("role, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "supplier" && profile?.role !== "admin") {
      return { success: false, message: "Only suppliers can apply for purchase order financing." };
    }

    if (!profile.organization_id && profile.role !== "admin") {
      return { success: false, message: "Supplier organisation profile is not configured." };
    }

    const admin = createAdminClient();

    // Query candidate purchase orders assigned to this supplier
    let poQuery = admin
      .from("purchase_orders")
      .select("id, order_reference, total_amount, status, issue_date, buyer_organization_id")
      .in("status", ["submitted", "accepted"])
      .order("created_at", { ascending: false });

    if (profile.role !== "admin" && profile.organization_id) {
      poQuery = poQuery.eq("supplier_organization_id", profile.organization_id);
    }

    const { data: pos, error: poErr } = await poQuery;

    if (poErr || !pos) {
      return { success: false, message: `Failed to load purchase orders: ${poErr?.message}` };
    }

    if (pos.length === 0) {
      return { success: true, data: [] };
    }

    // Find POs that already have an active financing request
    const poIds = pos.map((p) => p.id);
    const { data: activeRequests } = await admin
      .from("financing_requests")
      .select("purchase_order_id, status")
      .in("purchase_order_id", poIds)
      .in("status", ["submitted", "under_review", "approved", "draft"]);

    const activePoSet = new Set((activeRequests || []).map((r) => r.purchase_order_id));

    // Filter out POs with existing active requests
    const eligiblePos = pos.filter((p) => !activePoSet.has(p.id));

    // Enrich with buyer organization names
    const buyerIds = Array.from(new Set(eligiblePos.map((p) => p.buyer_organization_id)));
    let buyerMap: Record<string, string> = {};
    if (buyerIds.length > 0) {
      const { data: buyers } = await admin
        .from("organizations")
        .select("id, name")
        .in("id", buyerIds);
      if (buyers) {
        buyerMap = Object.fromEntries(buyers.map((b) => [b.id, b.name]));
      }
    }

    // Query line item counts
    const eligiblePoIds = eligiblePos.map((p) => p.id);
    let itemCountMap: Record<string, number> = {};
    if (eligiblePoIds.length > 0) {
      const { data: items } = await admin
        .from("order_items")
        .select("purchase_order_id")
        .in("purchase_order_id", eligiblePoIds);
      if (items) {
        items.forEach((item) => {
          itemCountMap[item.purchase_order_id] = (itemCountMap[item.purchase_order_id] || 0) + 1;
        });
      }
    }

    const result = eligiblePos.map((p) => ({
      id: p.id,
      order_reference: p.order_reference,
      total_amount: Number(p.total_amount),
      status: p.status,
      issue_date: p.issue_date,
      buyer_name: buyerMap[p.buyer_organization_id] || "Corporate Buyer",
      item_count: itemCountMap[p.id] || 0,
    }));

    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error querying eligible purchase orders.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Submit a new Purchase Order Financing Application.
 * Validates ownership, amount, duplicate prevention, and records immutable audit log.
 */
export async function createFinancingRequestAction(
  input: CreateFinancingRequestInput
): Promise<FinancingActionResult<{ requestId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to apply for financing." };
    }

    // 1. Verify user role & organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "supplier" && profile?.role !== "admin") {
      return {
        success: false,
        message: "Unauthorized: Only commodity suppliers can create financing applications.",
      };
    }

    // 2. Validate input fields
    if (!input.purchase_order_id) {
      return { success: false, message: "Please select an eligible purchase order." };
    }

    const requestedAmount = Number(input.requested_amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return { success: false, message: "Requested financing amount must be greater than zero." };
    }

    const purpose = input.purpose?.trim();
    if (!purpose || purpose.length < 5) {
      return {
        success: false,
        message: "Please describe the purpose of financing (e.g. working capital, aggregation, logistics).",
      };
    }

    const admin = createAdminClient();

    // 3. Query target purchase order
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("id, order_reference, total_amount, status, supplier_organization_id, buyer_organization_id")
      .eq("id", input.purchase_order_id)
      .maybeSingle();

    if (poErr || !po) {
      return { success: false, message: "Selected purchase order not found." };
    }

    // 4. Verify supplier ownership
    if (profile.role !== "admin" && profile.organization_id !== po.supplier_organization_id) {
      return {
        success: false,
        message: "Access Denied: You can only apply for financing on purchase orders assigned to your organization.",
      };
    }

    // 5. Verify purchase order is in confirmed state
    if (po.status !== "submitted" && po.status !== "accepted") {
      return {
        success: false,
        message: `Purchase order '${po.order_reference}' is in '${po.status}' state and not eligible for financing.`,
      };
    }

    // 6. Validate financing amount against PO total value
    const poTotal = Number(po.total_amount);
    if (requestedAmount > poTotal) {
      return {
        success: false,
        message: `Requested amount (₦${requestedAmount.toLocaleString()}) cannot exceed total purchase order value (₦${poTotal.toLocaleString()}).`,
      };
    }

    // 7. Duplicate Prevention Guard
    // Check if there is already an active financing request for this PO
    const { data: existingActive } = await admin
      .from("financing_requests")
      .select("id, status")
      .eq("purchase_order_id", input.purchase_order_id)
      .in("status", ["submitted", "under_review", "approved", "draft"])
      .maybeSingle();

    if (existingActive) {
      return {
        success: false,
        message: `An active financing request (#${existingActive.id.slice(0, 8)}) is already in '${existingActive.status}' state for this purchase order.`,
      };
    }

    const targetStatus: FinancingRequestStatus = input.status === "draft" ? "draft" : "submitted";
    const nowIso = new Date().toISOString();

    // 8. Insert into 'financing_requests' (strictly matching 9 schema columns)
    const { data: fr, error: frErr } = await admin
      .from("financing_requests")
      .insert({
        purchase_order_id: input.purchase_order_id,
        requested_by: user.id,
        requested_amount: requestedAmount,
        purpose: purpose,
        status: targetStatus,
        submitted_at: targetStatus === "submitted" ? nowIso : null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();

    if (frErr || !fr) {
      return { success: false, message: `Failed to create financing request: ${frErr?.message}` };
    }

    // Post-insert concurrency race condition guard:
    // If two requests bypassed the pre-check simultaneously, keep the earliest and delete duplicate
    const { data: allActiveRequests } = await admin
      .from("financing_requests")
      .select("id, created_at")
      .eq("purchase_order_id", input.purchase_order_id)
      .in("status", ["submitted", "under_review", "approved", "draft"])
      .order("created_at", { ascending: true });

    if (allActiveRequests && allActiveRequests.length > 1) {
      const winner = allActiveRequests[0];
      if (winner.id !== fr.id) {
        // This request lost the race condition: roll back immediately
        await admin.from("financing_requests").delete().eq("id", fr.id);
        return {
          success: false,
          message: "A simultaneous financing request was already submitted for this purchase order. Duplicate blocked.",
        };
      }
    }

    // 9. Record immutable audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: targetStatus === "draft" ? "FINANCING_REQUEST_SAVED_DRAFT" : "FINANCING_REQUEST_SUBMITTED",
      entity_table: "financing_requests",
      entity_id: fr.id,
      details: {
        purchase_order_id: po.id,
        order_reference: po.order_reference,
        requested_amount: requestedAmount,
        po_total_amount: poTotal,
        purpose: purpose,
        status: targetStatus,
        requester_name: profile.full_name || user.email,
      },
      created_at: nowIso,
    });

    revalidatePath("/dashboard/financing");
    revalidatePath(`/dashboard/purchase-orders/${po.id}`);

    return {
      success: true,
      message:
        targetStatus === "submitted"
          ? "Financing application submitted successfully. It has been queued for institutional underwriting."
          : "Financing application saved as draft.",
      data: { requestId: fr.id },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error creating financing request.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Update financing request status (Withdrawal or Progress to Under Review)
 */
export async function updateFinancingRequestStatusAction(
  requestId: string,
  newStatus: "under_review" | "withdrawn"
): Promise<FinancingActionResult<void>> {
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

    const admin = createAdminClient();

    // Query financing request
    const { data: fr, error: frErr } = await admin
      .from("financing_requests")
      .select("id, purchase_order_id, requested_by, status, requested_amount")
      .eq("id", requestId)
      .maybeSingle();

    if (frErr || !fr) {
      return { success: false, message: "Financing request not found." };
    }

    const nowIso = new Date().toISOString();

    if (newStatus === "withdrawn") {
      // Only original requester or admin can withdraw
      const isOwner = fr.requested_by === user.id;
      const isAdmin = profile?.role === "admin";

      if (!isOwner && !isAdmin) {
        return { success: false, message: "Unauthorized: You can only withdraw your own applications." };
      }

      if (fr.status === "approved" || fr.status === "declined" || fr.status === "withdrawn") {
        return {
          success: false,
          message: `Cannot withdraw an application that is already marked as '${fr.status}'.`,
        };
      }

      const { error: updErr } = await admin
        .from("financing_requests")
        .update({ status: "withdrawn", updated_at: nowIso })
        .eq("id", requestId);

      if (updErr) {
        return { success: false, message: `Withdrawal failed: ${updErr.message}` };
      }

      await admin.from("audit_logs").insert({
        actor_id: user.id,
        action: "FINANCING_REQUEST_WITHDRAWN",
        entity_table: "financing_requests",
        entity_id: requestId,
        details: { previous_status: fr.status, withdrawn_by: profile?.full_name || user.email },
        created_at: nowIso,
      });

      revalidatePath(`/dashboard/financing/${requestId}`);
      revalidatePath("/dashboard/financing");

      return { success: true, message: "Financing application withdrawn." };
    }

    if (newStatus === "under_review") {
      // Only financing reviewer or admin can move to under_review
      const canReview = profile?.role === "financier" || profile?.role === "admin";
      if (!canReview) {
        return {
          success: false,
          message: "Unauthorized: Only financing reviewers can update review status.",
        };
      }

      if (fr.status !== "submitted") {
        return {
          success: false,
          message: `Cannot transition request from '${fr.status}' to 'under_review'.`,
        };
      }

      const { error: updErr } = await admin
        .from("financing_requests")
        .update({ status: "under_review", updated_at: nowIso })
        .eq("id", requestId);

      if (updErr) {
        return { success: false, message: `Status update failed: ${updErr.message}` };
      }

      await admin.from("audit_logs").insert({
        actor_id: user.id,
        action: "FINANCING_REVIEW_STARTED",
        entity_table: "financing_requests",
        entity_id: requestId,
        details: { reviewer_id: user.id, reviewer_name: profile?.full_name || user.email },
        created_at: nowIso,
      });

      revalidatePath(`/dashboard/financing/${requestId}`);
      revalidatePath("/dashboard/financing");

      return { success: true, message: "Application marked as Under Review." };
    }

    return { success: false, message: "Unsupported status transition." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update status.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Submit an Institutional Financing Review Decision (Approve / Decline).
 * Strictly enforces:
 * 1. Reviewer role authorization (financier or admin).
 * 2. Conflict of interest prevention (requester cannot review their own application).
 * 3. Permitted decision check ('approved' | 'declined').
 * 4. Dual updates: records in 'financing_reviews' and updates 'financing_requests.status'.
 * 5. Immutable audit log in 'audit_logs'.
 */
export async function submitFinancingReviewAction(
  input: SubmitReviewDecisionInput
): Promise<FinancingActionResult<{ decision: FinancingReviewDecision }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to review financing applications." };
    }

    // 1. Enforce reviewer role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const isFinancier = profile?.role === "financier";
    const isAdmin = profile?.role === "admin";

    if (!isFinancier && !isAdmin) {
      return {
        success: false,
        message: "Unauthorized: Only institutional financing reviewers and administrators can record underwriting decisions.",
      };
    }

    // 2. Validate decision value
    if (input.decision !== "approved" && input.decision !== "declined") {
      return {
        success: false,
        message: "Invalid review decision. Permitted decisions are 'approved' or 'declined'.",
      };
    }

    const admin = createAdminClient();

    // 3. Query target financing request
    const { data: fr, error: frErr } = await admin
      .from("financing_requests")
      .select("id, purchase_order_id, requested_by, requested_amount, status, purpose")
      .eq("id", input.financing_request_id)
      .maybeSingle();

    if (frErr || !fr) {
      return { success: false, message: "Financing request not found." };
    }

    // 4. Conflict of Interest Check
    // The user who submitted the financing request CANNOT review it
    if (fr.requested_by === user.id) {
      return {
        success: false,
        message: "Conflict of Interest: You cannot review a financing request that you submitted.",
      };
    }

    // Organisation-level Conflict of Interest Check
    // Reviewer cannot belong to the supplying organisation applying for financing
    const { data: po } = await admin
      .from("purchase_orders")
      .select("supplier_organization_id")
      .eq("id", fr.purchase_order_id)
      .maybeSingle();

    if (
      profile?.organization_id &&
      po?.supplier_organization_id &&
      profile.organization_id === po.supplier_organization_id
    ) {
      return {
        success: false,
        message: "Conflict of Interest: You cannot review a financing application submitted by your own organisation.",
      };
    }

    // 5. Verify request is in a reviewable state
    if (fr.status !== "submitted" && fr.status !== "under_review") {
      return {
        success: false,
        message: `Cannot record decision: Request is currently in '${fr.status}' state and has already been concluded.`,
      };
    }

    // Check if an underwriting decision has already been recorded
    const { data: existingReview } = await admin
      .from("financing_reviews")
      .select("id, decision")
      .eq("financing_request_id", input.financing_request_id)
      .maybeSingle();

    if (existingReview) {
      return {
        success: false,
        message: `An underwriting decision ('${existingReview.decision}') has already been submitted for this request.`,
      };
    }

    const nowIso = new Date().toISOString();
    const comments = input.comments?.trim() || null;

    // 6. Insert review into 'financing_reviews' (strictly 6 schema columns)
    const { data: rev, error: revErr } = await admin
      .from("financing_reviews")
      .insert({
        financing_request_id: input.financing_request_id,
        reviewer_id: user.id,
        decision: input.decision,
        comments: comments,
        reviewed_at: nowIso,
      })
      .select("id")
      .single();

    if (revErr || !rev) {
      return {
        success: false,
        message: `Failed to record review: ${revErr?.message}`,
      };
    }

    // Post-insert concurrency check: If another review was submitted simultaneously, rollback duplicate
    const { data: allReviews } = await admin
      .from("financing_reviews")
      .select("id, reviewed_at")
      .eq("financing_request_id", input.financing_request_id)
      .order("reviewed_at", { ascending: true });

    if (allReviews && allReviews.length > 1) {
      const winner = allReviews[0];
      if (winner.id !== rev.id) {
        await admin.from("financing_reviews").delete().eq("id", rev.id);
        return {
          success: false,
          message: "A concurrent underwriting decision was already submitted for this request.",
        };
      }
    }

    // 7. Update status in 'financing_requests'
    // Status check constraint permits 'approved' and 'declined'
    const { error: updErr } = await admin
      .from("financing_requests")
      .update({
        status: input.decision,
        updated_at: nowIso,
      })
      .eq("id", input.financing_request_id);

    if (updErr) {
      return {
        success: false,
        message: `Review recorded, but status update failed: ${updErr.message}`,
      };
    }

    // 8. Record immutable audit log
    const auditAction =
      input.decision === "approved"
        ? "FINANCING_REQUEST_APPROVED"
        : "FINANCING_REQUEST_DECLINED";

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: auditAction,
      entity_table: "financing_requests",
      entity_id: fr.id,
      details: {
        financing_review_id: rev.id,
        purchase_order_id: fr.purchase_order_id,
        requested_amount: fr.requested_amount,
        previous_status: fr.status,
        new_status: input.decision,
        reviewer_name: profile?.full_name || user.email,
        comments: comments,
      },
      created_at: nowIso,
    });

    revalidatePath(`/dashboard/financing/${fr.id}`);
    revalidatePath("/dashboard/financing");
    revalidatePath(`/dashboard/purchase-orders/${fr.purchase_order_id}`);

    return {
      success: true,
      message:
        input.decision === "approved"
          ? "Financing request APPROVED. Counterparties will be notified on the dashboard."
          : "Financing request DECLINED. Underwriting remarks recorded in audit history.",
      data: { decision: input.decision },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error processing review decision.";
    return { success: false, message: msg };
  }
}
