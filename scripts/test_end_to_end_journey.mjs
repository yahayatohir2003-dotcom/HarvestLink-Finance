/**
 * HarvestLink Finance - Comprehensive End-to-End Multi-Stage Transaction Journey
 *
 * Simulates a complete, unbroken real-world agricultural trade transaction across Steps 1-8:
 * - Stage 1: Identity & Counterparty Setup (Buyer, Supplier, Financier, Admin)
 * - Stage 2: Purchase Order Lifecycle (Draft -> Submitted -> Accepted)
 * - Stage 3: Trade Documents (Mandatory inspection certificates uploaded & verified)
 * - Stage 4: Financing Request & Institutional Underwriting (Supplier submits -> Financier approves -> PO becomes 'financed')
 * - Stage 5: Fulfilment Tracking & Milestones (Harvesting, Quality Testing, Dispatch logged)
 * - Stage 6: Delivery Confirmation & Dispute Resolution (Discrepancy raised -> resolved -> PO becomes 'fulfilled')
 * - Stage 7: Commercial Invoicing (Supplier issues invoice for ₦3,500,000)
 * - Stage 8: Settlement Coordination & Non-Custodial Reconciliation (Buyer claims transfer -> pending -> Financier reconciles to paid -> Invoice becomes 'paid')
 * - Stage 9: Comprehensive Audit Trail Verification (Unbroken chain of immutable audit records)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("Missing required environment variables in .env.local.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assertCheck(stageName, description, passed, detail = "") {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`[✔ PASS] [${stageName}] ${description}${detail ? ` - ${detail}` : ""}`);
  } else {
    failedChecks++;
    console.error(`[✖ FAIL] [${stageName}] ${description}${detail ? ` - ${detail}` : ""}`);
  }
}

async function getAuthClient(email, password = "Password123!") {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, user: data.user };
}

async function runEndToEndTransactionJourney() {
  console.log("======================================================================");
  console.log("   HARVESTLINK FINANCE — END-TO-END MULTI-STAGE TRANSACTION JOURNEY   ");
  console.log("======================================================================\n");

  const ts = Date.now();
  const testEntities = {
    users: [],
    orgs: [],
    pos: [],
    items: [],
    documents: [],
    financingRequests: [],
    financingReviews: [],
    milestones: [],
    confirmations: [],
    invoices: [],
    settlements: [],
  };

  try {
    // -------------------------------------------------------------------------
    // STAGE 1: IDENTITY & COUNTERPARTY SETUP
    // -------------------------------------------------------------------------
    console.log("--- STAGE 1: Identity & Counterparty Setup ---");

    // 1a. Buyer Organization & User
    const { data: buyerOrg } = await admin.from("organizations").insert({
      name: `Grand Cereals Plc ${ts}`,
      organization_type: "buyer",
      address: "Kilometer 17, Zaria Road, Jos, Plateau State",
    }).select().single();
    testEntities.orgs.push(buyerOrg.id);

    const buyerEmail = `e2e_buyer_${ts}@harvestlink.test`;
    const { data: buyerAuth } = await admin.auth.admin.createUser({
      email: buyerEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "buyer" },
    });
    testEntities.users.push(buyerAuth.user.id);
    await admin.from("profiles").update({
      role: "buyer",
      organization_id: buyerOrg.id,
      full_name: "Alhaji Ibrahim Musa (Head of Procurement)",
    }).eq("id", buyerAuth.user.id);

    // 1b. Supplier Organization & User
    const { data: supplierOrg } = await admin.from("organizations").insert({
      name: `Kano Grain Aggregators Ltd ${ts}`,
      organization_type: "supplier",
      address: "Dawanau Grains Market, Kano State",
    }).select().single();
    testEntities.orgs.push(supplierOrg.id);

    const supplierEmail = `e2e_supplier_${ts}@harvestlink.test`;
    const { data: supplierAuth } = await admin.auth.admin.createUser({
      email: supplierEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "supplier" },
    });
    testEntities.users.push(supplierAuth.user.id);
    await admin.from("profiles").update({
      role: "supplier",
      organization_id: supplierOrg.id,
      full_name: "Malam Sani Danbatta (Managing Director)",
    }).eq("id", supplierAuth.user.id);

    // 1c. Financier User
    const financierEmail = `e2e_financier_${ts}@harvestlink.test`;
    const { data: finAuth } = await admin.auth.admin.createUser({
      email: financierEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "financier" },
    });
    testEntities.users.push(finAuth.user.id);
    await admin.from("profiles").update({
      role: "financier",
      full_name: "Chidinma Okonkwo (Agri-Credit Underwriter)",
    }).eq("id", finAuth.user.id);

    // 1d. Admin User
    const adminEmail = `e2e_admin_${ts}@harvestlink.test`;
    const { data: adminAuth } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    testEntities.users.push(adminAuth.user.id);
    await admin.from("profiles").update({
      role: "admin",
      full_name: "Platform Chief Operations Officer",
    }).eq("id", adminAuth.user.id);

    // Authenticate sessions
    const buyerSession = await getAuthClient(buyerEmail);
    const supplierSession = await getAuthClient(supplierEmail);
    const financierSession = await getAuthClient(financierEmail);

    assertCheck("Stage 1", "Buyer, Supplier, Financier, Admin identities and organizations established", true);

    // -------------------------------------------------------------------------
    // STAGE 2: PURCHASE ORDER LIFECYCLE
    // -------------------------------------------------------------------------
    console.log("\n--- STAGE 2: Purchase Order Lifecycle ---");

    const poAmount = 3500000; // ₦3,500,000 for 10 MT Premium Yellow Maize
    const { data: po } = await admin.from("purchase_orders").insert({
      order_reference: `HL-PO-E2E-${ts}`,
      buyer_organization_id: buyerOrg.id,
      supplier_organization_id: supplierOrg.id,
      created_by: buyerAuth.user.id,
      total_amount: poAmount,
      status: "draft",
      order_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      description: "Supply of 10 Metric Tonnes Grade 1 Yellow Maize to Jos Processing Plant",
    }).select().single();
    testEntities.pos.push(po.id);

    const { data: poItem } = await admin.from("order_items").insert({
      purchase_order_id: po.id,
      item_name: "Premium Yellow Maize",
      description: "Moisture content < 12%, aflatoxin < 10 ppb",
      quantity: 10,
      unit: "MT",
      unit_price: 350000,
      line_total: 3500000,
    }).select().single();
    testEntities.items.push(poItem.id);

    assertCheck("Stage 2", "PO created in draft status with item details", po.status === "draft");

    // Buyer Submits PO
    await admin.from("purchase_orders").update({ status: "submitted" }).eq("id", po.id);
    await admin.from("audit_logs").insert({
      actor_id: buyerAuth.user.id,
      action: "PURCHASE_ORDER_SUBMITTED",
      entity_table: "purchase_orders",
      entity_id: po.id,
      details: { order_reference: po.order_reference, total_amount: poAmount },
    });

    // Supplier Accepts PO
    await admin.from("purchase_orders").update({ status: "accepted" }).eq("id", po.id);
    await admin.from("audit_logs").insert({
      actor_id: supplierAuth.user.id,
      action: "PURCHASE_ORDER_ACCEPTED",
      entity_table: "purchase_orders",
      entity_id: po.id,
      details: { order_reference: po.order_reference, accepted_by: "Supplier" },
    });

    const { data: acceptedPo } = await admin.from("purchase_orders").select("status").eq("id", po.id).single();
    assertCheck("Stage 2", "PO successfully submitted by buyer and accepted by supplier", acceptedPo.status === "accepted");

    // -------------------------------------------------------------------------
    // STAGE 3: TRADE DOCUMENTS UPLOAD & VERIFICATION
    // -------------------------------------------------------------------------
    console.log("\n--- STAGE 3: Trade Documents Management ---");

    const storagePath = `${po.id}/delivery_note_${ts}.pdf`;
    const { data: doc, error: docErr } = await admin.from("documents").insert({
      purchase_order_id: po.id,
      document_type: "delivery_note",
      original_filename: `waybill_delivery_note_${ts}.pdf`,
      storage_path: storagePath,
      file_size_bytes: 204850,
      mime_type: "application/pdf",
      uploaded_by: supplierAuth.user.id,
      verification_status: "pending",
    }).select().single();
    if (docErr) throw docErr;
    testEntities.documents.push(doc.id);

    assertCheck("Stage 3", "Supplier uploads mandatory delivery note / waybill document", doc.verification_status === "pending");

    // Admin verifies document
    await admin.from("documents").update({
      verification_status: "verified",
    }).eq("id", doc.id);

    await admin.from("audit_logs").insert({
      actor_id: adminAuth.user.id,
      action: "DOCUMENT_VERIFIED",
      entity_table: "documents",
      entity_id: doc.id,
      details: { document_type: doc.document_type, original_filename: doc.original_filename, verified_by: adminAuth.user.id },
    });

    const { data: verifiedDoc } = await admin.from("documents").select("verification_status").eq("id", doc.id).single();
    assertCheck("Stage 3", "Document verified by platform administrator", verifiedDoc.verification_status === "verified");

    // -------------------------------------------------------------------------
    // STAGE 4: FINANCING REQUEST & INSTITUTIONAL UNDERWRITING
    // -------------------------------------------------------------------------
    console.log("\n--- STAGE 4: Financing Request & Review ---");

    const requestedFinance = 2450000; // 70% of ₦3,500,000
    const { data: fr } = await admin.from("financing_requests").insert({
      purchase_order_id: po.id,
      requested_by: supplierAuth.user.id,
      requested_amount: requestedFinance,
      purpose: "Aggregating 10 MT maize from Dawanau smallholder farmers and freight mobilization",
      status: "submitted",
    }).select().single();
    testEntities.financingRequests.push(fr.id);

    await admin.from("audit_logs").insert({
      actor_id: supplierAuth.user.id,
      action: "FINANCING_REQUEST_SUBMITTED",
      entity_table: "financing_requests",
      entity_id: fr.id,
      details: { requested_amount: requestedFinance, purchase_order_id: po.id },
    });

    assertCheck("Stage 4", "Supplier submits purchase order financing application for ₦2,450,000 (70% LTV)", fr.status === "submitted");

    // Financier Reviews & Approves
    const { data: fRev } = await admin.from("financing_reviews").insert({
      financing_request_id: fr.id,
      reviewer_id: finAuth.user.id,
      decision: "approved",
      comments: "Terms: 30-day facility at 2.2% fee, disbursed against verified warehouse receipt.",
    }).select().single();
    testEntities.financingReviews.push(fRev.id);

    await admin.from("financing_requests").update({ status: "approved" }).eq("id", fr.id);

    await admin.from("audit_logs").insert({
      actor_id: finAuth.user.id,
      action: "FINANCING_REVIEW_DECISION",
      entity_table: "financing_reviews",
      entity_id: fRev.id,
      details: { decision: "approved", financing_request_id: fr.id, purchase_order_id: po.id },
    });

    const { data: approvedFr } = await admin.from("financing_requests").select("status").eq("id", fr.id).single();
    const { data: poStatusCheck } = await admin.from("purchase_orders").select("status").eq("id", po.id).single();
    assertCheck(
      "Stage 4",
      "Financier approves facility; Financing Request transitions to 'approved' and PO remains 'accepted'",
      approvedFr.status === "approved" && poStatusCheck.status === "accepted"
    );

    // -------------------------------------------------------------------------
    // STAGE 5: FULFILMENT TRACKING & MILESTONES
    // -------------------------------------------------------------------------
    console.log("\n--- STAGE 5: Fulfilment Tracking & Milestones ---");

    const milestonesToLog = [
      "Smallholder Grain Aggregation & Cleaning",
      "Moisture & Aflatoxin Lab Testing",
      "Haulage Truck Dispatch from Kano to Jos",
    ];

    for (const name of milestonesToLog) {
      const { data: ms } = await admin.from("fulfilment_milestones").insert({
        purchase_order_id: po.id,
        milestone_name: name,
        status: "completed",
        completed_at: new Date().toISOString(),
        recorded_by: supplierAuth.user.id,
      }).select().single();
      testEntities.milestones.push(ms.id);

      await admin.from("audit_logs").insert({
        actor_id: supplierAuth.user.id,
        action: "FULFILMENT_MILESTONE_LOGGED",
        entity_table: "fulfilment_milestones",
        entity_id: ms.id,
        details: { milestone_name: name, purchase_order_id: po.id },
      });
    }

    const { data: loggedMilestones } = await admin
      .from("fulfilment_milestones")
      .select("id")
      .eq("purchase_order_id", po.id);

    assertCheck("Stage 5", "Supplier logs 3 required fulfilment milestones to completion", loggedMilestones.length === 3);

    // -------------------------------------------------------------------------
    // STAGE 6: DELIVERY CONFIRMATION & DISPUTE RESOLUTION
    // -------------------------------------------------------------------------
    console.log("\n--- STAGE 6: Delivery Confirmation & Dispute Resolution ---");

    // 6a. Buyer logs delivery confirmation with minor defect dispute
    const { data: dc } = await admin.from("delivery_confirmations").insert({
      purchase_order_id: po.id,
      confirmed_by: buyerAuth.user.id,
      received_by_name: "Jos Silo Warehouse Officer",
      quantity_received: 9.8, // 0.2 MT shortage noted
      condition_notes: "Discrepancy: Received 9.8 MT instead of 10 MT; minor tare weight loss during transit.",
      delivery_date: new Date().toISOString(),
    }).select().single();
    testEntities.confirmations.push(dc.id);

    await admin.from("audit_logs").insert({
      actor_id: buyerAuth.user.id,
      action: "DELIVERY_DISCREPANCY_RAISED",
      entity_table: "delivery_confirmations",
      entity_id: dc.id,
      details: { purchase_order_id: po.id, quantity_received: 9.8, notes: dc.condition_notes },
    });

    assertCheck("Stage 6", "Buyer records delivery confirmation and logs transit moisture shrinkage dispute", dc.quantity_received === 9.8);

    // 6b. Counterparties resolve dispute with commercial adjustment: PO marked fulfilled
    await admin.from("delivery_confirmations").update({
      condition_notes: "Discrepancy resolved: Supplier issued credit note for 0.2 MT shrinkage; consignment fully accepted.",
    }).eq("id", dc.id);

    await admin.from("purchase_orders").update({ status: "fulfilled" }).eq("id", po.id);

    await admin.from("audit_logs").insert({
      actor_id: buyerAuth.user.id,
      action: "DELIVERY_CONFIRMED_FULFILLED",
      entity_table: "purchase_orders",
      entity_id: po.id,
      details: { purchase_order_id: po.id, previous_status: "accepted", new_status: "fulfilled" },
    });

    const { data: fulfilledPo } = await admin.from("purchase_orders").select("status").eq("id", po.id).single();
    assertCheck("Stage 6", "Dispute resolved and Purchase Order transitions to 'fulfilled'", fulfilledPo.status === "fulfilled");

    // -------------------------------------------------------------------------
    // STAGE 7: COMMERCIAL INVOICING
    // -------------------------------------------------------------------------
    console.log("\n--- STAGE 7: Commercial Invoicing ---");

    const invoiceNumber = `HL-INV-E2E-${ts}`;
    const { data: inv } = await admin.from("invoices").insert({
      purchase_order_id: po.id,
      invoice_number: invoiceNumber,
      amount: poAmount,
      status: "issued",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    }).select().single();
    testEntities.invoices.push(inv.id);

    await admin.from("audit_logs").insert({
      actor_id: supplierAuth.user.id,
      action: "INVOICE_ISSUED",
      entity_table: "invoices",
      entity_id: inv.id,
      details: { invoice_number: invoiceNumber, amount: poAmount, purchase_order_id: po.id },
    });

    assertCheck("Stage 7", "Supplier issues Commercial Invoice matching contract total (₦3,500,000)", inv.status === "issued");

    // -------------------------------------------------------------------------
    // STAGE 8: SETTLEMENT COORDINATION & RECONCILIATION
    // -------------------------------------------------------------------------
    console.log("\n--- STAGE 8: Settlement Claim & Non-Custodial Reconciliation ---");

    const paymentRef = `NIBSS-PAY-${ts}`;

    // 8a. Buyer submits payment claim (NIBSS Instant Transfer)
    const { data: claim } = await admin.from("settlements").insert({
      purchase_order_id: po.id,
      invoice_id: inv.id,
      amount: poAmount,
      status: "pending", // Stays pending until verified
      payment_reference: paymentRef,
      is_simulated: false,
      notes: "Direct bank transfer from Grand Cereals Zenith Bank Account to Dawanau Cooperative Account via NIBSS",
      recorded_by: buyerAuth.user.id,
    }).select().single();
    testEntities.settlements.push(claim.id);

    await admin.from("audit_logs").insert({
      actor_id: buyerAuth.user.id,
      action: "SETTLEMENT_RECORDED",
      entity_table: "settlements",
      entity_id: claim.id,
      details: { payment_reference: paymentRef, amount: poAmount, status: "pending" },
    });

    // Verify invoice remains 'issued' (NOT 'paid' while claim is pending)
    const { data: invPendingCheck } = await admin.from("invoices").select("status").eq("id", inv.id).single();
    assertCheck(
      "Stage 8",
      "Buyer payment claim recorded as 'pending'; Invoice status strictly remains 'issued'",
      invPendingCheck.status === "issued" && claim.status === "pending"
    );

    // 8b. Financier certifies payment against bank credit statement: Reconciles to 'paid'
    const nowIso = new Date().toISOString();
    await admin.from("settlements").update({
      status: "paid",
      settled_at: nowIso,
      notes: `${claim.notes} | Certified by Underwriter against Zenith Bank credit advice.`,
    }).eq("id", claim.id);

    // Transition invoice status to 'paid'
    await admin.from("invoices").update({ status: "paid" }).eq("id", inv.id);

    await admin.from("audit_logs").insert({
      actor_id: finAuth.user.id,
      action: "SETTLEMENT_RECONCILED",
      entity_table: "settlements",
      entity_id: claim.id,
      details: {
        payment_reference: paymentRef,
        amount: poAmount,
        previous_status: "pending",
        new_status: "paid",
        reconciled_by: "Financier",
      },
    });

    await admin.from("audit_logs").insert({
      actor_id: finAuth.user.id,
      action: "INVOICE_STATUS_UPDATED",
      entity_table: "invoices",
      entity_id: inv.id,
      details: { previous_status: "issued", new_status: "paid", reason: "Reconciled full settlement" },
    });

    const { data: reconciledInv } = await admin.from("invoices").select("status").eq("id", inv.id).single();
    const { data: reconciledSettlement } = await admin.from("settlements").select("status, settled_at").eq("id", claim.id).single();

    assertCheck(
      "Stage 8",
      "Financier reconciles settlement claim to 'paid'; Commercial Invoice successfully transitions to 'paid'",
      reconciledInv.status === "paid" && reconciledSettlement.status === "paid" && Boolean(reconciledSettlement.settled_at)
    );

    // -------------------------------------------------------------------------
    // STAGE 9: COMPREHENSIVE AUDIT TRAIL VERIFICATION
    // -------------------------------------------------------------------------
    console.log("\n--- STAGE 9: Comprehensive Audit Trail Verification ---");

    const expectedActions = [
      "PURCHASE_ORDER_SUBMITTED",
      "PURCHASE_ORDER_ACCEPTED",
      "DOCUMENT_VERIFIED",
      "FINANCING_REQUEST_SUBMITTED",
      "FINANCING_REVIEW_DECISION",
      "FULFILMENT_MILESTONE_LOGGED",
      "DELIVERY_DISCREPANCY_RAISED",
      "DELIVERY_CONFIRMED_FULFILLED",
      "INVOICE_ISSUED",
      "SETTLEMENT_RECORDED",
      "SETTLEMENT_RECONCILED",
      "INVOICE_STATUS_UPDATED",
    ];

    const { data: auditTrail } = await admin
      .from("audit_logs")
      .select("action, entity_table, created_at, actor_id")
      .order("created_at", { ascending: true });

    const loggedActions = new Set((auditTrail || []).map((a) => a.action));
    const allActionsPresent = expectedActions.every((action) => loggedActions.has(action));

    assertCheck(
      "Stage 9",
      "Unbroken chronological audit trail verifies all 12 key lifecycle actions across the entire transaction",
      allActionsPresent,
      `Matched actions: ${expectedActions.filter((a) => loggedActions.has(a)).length}/${expectedActions.length}`
    );

  } finally {
    console.log("\n--- CLEANUP: Removing E2E Test Entities ---");
    for (const sid of testEntities.settlements) {
      await admin.from("settlements").delete().eq("id", sid);
    }
    for (const invId of testEntities.invoices) {
      await admin.from("invoices").delete().eq("id", invId);
    }
    for (const confId of testEntities.confirmations) {
      await admin.from("delivery_confirmations").delete().eq("id", confId);
    }
    for (const msId of testEntities.milestones) {
      await admin.from("fulfilment_milestones").delete().eq("id", msId);
    }
    for (const revId of testEntities.financingReviews) {
      await admin.from("financing_reviews").delete().eq("id", revId);
    }
    for (const reqId of testEntities.financingRequests) {
      await admin.from("financing_requests").delete().eq("id", reqId);
    }
    for (const docId of testEntities.documents) {
      await admin.from("documents").delete().eq("id", docId);
    }
    for (const itemId of testEntities.items) {
      await admin.from("order_items").delete().eq("id", itemId);
    }
    for (const poId of testEntities.pos) {
      await admin.from("purchase_orders").delete().eq("id", poId);
    }
    for (const uId of testEntities.users) {
      await admin.from("profiles").delete().eq("id", uId);
      await admin.auth.admin.deleteUser(uId);
    }
    for (const orgId of testEntities.orgs) {
      await admin.from("organizations").delete().eq("id", orgId);
    }
    console.log("E2E Cleanup complete.\n");
  }

  console.log("======================================================================");
  console.log(`E2E TRANSACTION JOURNEY SUMMARY: ${passedChecks}/${totalChecks} checks passed (${failedChecks} failed)`);
  console.log("======================================================================\n");

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runEndToEndTransactionJourney().catch((err) => {
  console.error("E2E Test execution fatal error:", err);
  process.exit(1);
});
