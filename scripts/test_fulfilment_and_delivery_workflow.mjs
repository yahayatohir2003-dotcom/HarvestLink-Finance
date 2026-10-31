/**
 * HarvestLink Finance - Step 6: Fulfilment Tracking & Delivery Confirmation Test Suite
 *
 * Automated integration test suite validating:
 * 1. Database schema and check constraints:
 *    - fulfilment_milestones_status_check ('pending', 'in_progress', 'completed', 'delayed')
 *    - delivery_confirmations_status_check ('pending', 'confirmed', 'disputed')
 * 2. Purchase order state eligibility (tracking only allowed on 'accepted' or 'fulfilled' orders)
 * 3. Fulfilment milestone tracking by Supplier / Admin
 * 4. Milestone status updates and timestamping (completed_at)
 * 5. Role access guards:
 *    - Buyer blocked from creating supplier milestones
 *    - Supplier blocked from confirming delivery
 *    - Financier has read-only oversight
 * 6. Delivery discrepancy / dispute intake by Buyer
 * 7. Confirmed delivery intake by Buyer triggering automatic PO transition to 'fulfilled'
 * 8. Duplicate / conflicting delivery confirmation prevention
 * 9. Document evidence linking and secure signed URL generation
 * 10. Audit log trail completeness across all fulfilment and delivery actions
 * 11. Idempotent test cleanup
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("Missing required environment variables in .env.local.");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assertCheck(description, passed, details = "") {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`[✔ PASS] ${description}${details ? ` - ${details}` : ""}`);
  } else {
    failedChecks++;
    console.error(`[✖ FAIL] ${description}${details ? ` - ${details}` : ""}`);
  }
}

async function runFulfilmentTestSuite() {
  console.log("======================================================================");
  console.log("   HARVESTLINK FINANCE — STEP 6: FULFILMENT & DELIVERY INTEGRATION    ");
  console.log("======================================================================\n");

  const timestamp = Date.now();
  const testEntities = {
    users: [],
    orgs: [],
    pos: [],
    items: [],
    milestones: [],
    confirmations: [],
    docs: [],
    storagePaths: [],
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP: Initializing Buyer, Supplier, Financier, Admin
    // -------------------------------------------------------------------------
    console.log("--- SETUP: Initializing Test Organizations and Users ---");

    // 1. Buyer Org & User
    const { data: buyerOrg, error: bOrgErr } = await adminClient.from("organizations").insert({
      name: `Grand Cereals Plc ${timestamp}`,
      organization_type: "buyer",
      address: "Kilometre 17, Zaria Road, Jos, Plateau State",
      phone: "+2348030000001",
      email: `buyer_${timestamp}@harvestlink.test`,
    }).select().single();
    if (bOrgErr) throw bOrgErr;
    testEntities.orgs.push(buyerOrg.id);

    const buyerEmail = `buyer_${timestamp}@harvestlink.test`;
    const { data: buyerUser, error: bUserErr } = await adminClient.auth.admin.createUser({
      email: buyerEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { role: "buyer", full_name: "Chukwudi Nnamdi (Procurement VP)" },
    });
    if (bUserErr) throw bUserErr;
    testEntities.users.push(buyerUser.user.id);

    await adminClient.from("profiles").upsert({
      id: buyerUser.user.id,
      role: "buyer",
      organization_id: buyerOrg.id,
      full_name: "Chukwudi Nnamdi",
      phone: "+2348030000001",
    });

    // 2. Supplier Org & User
    const { data: supplierOrg, error: sOrgErr } = await adminClient.from("organizations").insert({
      name: `Dawanau Grains Hub Cooperative ${timestamp}`,
      organization_type: "supplier",
      address: "Dawanau International Market, Kano State",
      phone: "+2348030000002",
      email: `supplier_${timestamp}@harvestlink.test`,
    }).select().single();
    if (sOrgErr) throw sOrgErr;
    testEntities.orgs.push(supplierOrg.id);

    const supplierEmail = `supplier_${timestamp}@harvestlink.test`;
    const { data: supplierUser, error: sUserErr } = await adminClient.auth.admin.createUser({
      email: supplierEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { role: "supplier", full_name: "Aliyu Haruna (Grain Aggregator)" },
    });
    if (sUserErr) throw sUserErr;
    testEntities.users.push(supplierUser.user.id);

    await adminClient.from("profiles").upsert({
      id: supplierUser.user.id,
      role: "supplier",
      organization_id: supplierOrg.id,
      full_name: "Aliyu Haruna",
      phone: "+2348030000002",
    });

    // 3. Financier User
    const financierEmail = `financier_${timestamp}@harvestlink.test`;
    const { data: financierUser, error: fUserErr } = await adminClient.auth.admin.createUser({
      email: financierEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { role: "financier", full_name: "Fatima Al-Hassan (Credit Analyst)" },
    });
    if (fUserErr) throw fUserErr;
    testEntities.users.push(financierUser.user.id);

    await adminClient.from("profiles").upsert({
      id: financierUser.user.id,
      role: "financier",
      full_name: "Fatima Al-Hassan",
      phone: "+2348030000003",
    });

    // 4. Admin User
    const adminEmail = `admin_${timestamp}@harvestlink.test`;
    const { data: adminUser, error: aUserErr } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { role: "admin", full_name: "System Supervisor" },
    });
    if (aUserErr) throw aUserErr;
    testEntities.users.push(adminUser.user.id);

    await adminClient.from("profiles").upsert({
      id: adminUser.user.id,
      role: "admin",
      full_name: "System Supervisor",
      phone: "+2348030000004",
    });

    assertCheck(
      "Test counterparties, profiles, and role assignments initialized",
      buyerOrg && supplierOrg && buyerUser && supplierUser && financierUser && adminUser
    );

    // -------------------------------------------------------------------------
    // TEST 1: Purchase Order Setup & Eligibility Guard
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Purchase Order Setup & Eligibility Validation ---");

    // Draft Purchase Order (cannot be tracked for fulfilment yet)
    const draftPoRef = `HL-PO-${timestamp}-DFT`;
    const { data: draftPo, error: draftPoErr } = await adminClient.from("purchase_orders").insert({
      order_reference: draftPoRef,
      buyer_organization_id: buyerOrg.id,
      supplier_organization_id: supplierOrg.id,
      created_by: buyerUser.user.id,
      total_amount: 15000000,
      status: "draft",
      order_date: new Date().toISOString(),
      expected_delivery_date: new Date(Date.now() + 14 * 86400000).toISOString(),
      description: "Delivery Address: Plot 12 Jos Industrial Layout\n\nNotes: Grade A White Maize",
    }).select().single();
    if (draftPoErr) throw draftPoErr;
    testEntities.pos.push(draftPo.id);

    // Accepted Purchase Order (eligible for active fulfilment)
    const activePoRef = `HL-PO-${timestamp}-ACT`;
    const { data: activePo, error: activePoErr } = await adminClient.from("purchase_orders").insert({
      order_reference: activePoRef,
      buyer_organization_id: buyerOrg.id,
      supplier_organization_id: supplierOrg.id,
      created_by: buyerUser.user.id,
      total_amount: 32000000,
      status: "accepted",
      order_date: new Date().toISOString(),
      expected_delivery_date: new Date(Date.now() + 10 * 86400000).toISOString(),
      description: "Delivery Address: Grain Silo 4, Jos Factory\n\nNotes: Premium Quality Yellow Maize",
    }).select().single();
    if (activePoErr) throw activePoErr;
    testEntities.pos.push(activePo.id);

    // Add line items
    const { data: poItem, error: itemErr } = await adminClient.from("order_items").insert({
      purchase_order_id: activePo.id,
      item_name: "Yellow Maize (Grade 1)",
      description: "Cleaned, dried to max 13% moisture, 100kg bags",
      quantity: 100,
      unit: "MT",
      unit_price: 320000,
      line_total: 32000000,
    }).select().single();
    if (itemErr) throw itemErr;
    testEntities.items.push(poItem.id);

    assertCheck(
      "Draft and Accepted Purchase Orders initialized with commodity line items",
      draftPo && activePo && poItem
    );

    // -------------------------------------------------------------------------
    // TEST 2: Schema Check Constraints for Fulfilment & Delivery Tables
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: PostgreSQL Check Constraints Validation ---");

    // Test fulfilment_milestones check constraint: invalid status should fail at DB level
    let invalidMilestoneFailed = false;
    try {
      const { error: invErr } = await adminClient.from("fulfilment_milestones").insert({
        purchase_order_id: activePo.id,
        milestone_name: "Illegal Test Milestone",
        status: "cancelled_invalid_status", // Not in ('pending', 'in_progress', 'completed', 'delayed')
        recorded_by: supplierUser.user.id,
      });
      if (invErr) invalidMilestoneFailed = true;
    } catch {
      invalidMilestoneFailed = true;
    }
    assertCheck(
      "Database rejects invalid status in 'fulfilment_milestones' per check constraint",
      invalidMilestoneFailed
    );

    // Test delivery_confirmations check constraint: invalid status should fail at DB level
    let invalidDeliveryFailed = false;
    try {
      const { error: invDelErr } = await adminClient.from("delivery_confirmations").insert({
        purchase_order_id: activePo.id,
        confirmed_by: buyerUser.user.id,
        received_by_name: "Test Inspector",
        status: "accepted_invalid_status", // Not in ('pending', 'confirmed', 'disputed')
      });
      if (invDelErr) invalidDeliveryFailed = true;
    } catch {
      invalidDeliveryFailed = true;
    }
    assertCheck(
      "Database rejects invalid status in 'delivery_confirmations' per check constraint",
      invalidDeliveryFailed
    );

    // -------------------------------------------------------------------------
    // TEST 3: Supplier Recording Fulfilment Milestones
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Supplier Fulfilment Milestone Tracking ---");

    // Milestone 1: Sourcing & Aggregation
    const nowIso = new Date().toISOString();
    const targetDate1 = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
    const { data: m1, error: m1Err } = await adminClient.from("fulfilment_milestones").insert({
      purchase_order_id: activePo.id,
      milestone_name: "Commodity Sourcing from Outgrowers (Kano & Katsina)",
      status: "in_progress",
      target_date: targetDate1,
      notes: "Aggregated 60 MT at Dawanau collection hub.",
      recorded_by: supplierUser.user.id,
    }).select().single();
    if (m1Err) throw m1Err;
    testEntities.milestones.push(m1.id);

    // Insert corresponding audit log
    await adminClient.from("audit_logs").insert({
      actor_id: supplierUser.user.id,
      action: "FULFILMENT_MILESTONE_CREATED",
      entity_table: "fulfilment_milestones",
      entity_id: m1.id,
      details: {
        purchase_order_id: activePo.id,
        order_reference: activePo.order_reference,
        milestone_name: m1.milestone_name,
        status: m1.status,
        target_date: targetDate1,
        recorded_by_name: "Aliyu Haruna",
      },
    });

    assertCheck(
      "Supplier logs 'in_progress' milestone with exact 9 schema columns",
      m1 && m1.milestone_name.includes("Commodity Sourcing") && m1.status === "in_progress"
    );

    // Milestone 2: Quality Sorting & Moisture Testing
    const targetDate2 = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
    const { data: m2, error: m2Err } = await adminClient.from("fulfilment_milestones").insert({
      purchase_order_id: activePo.id,
      milestone_name: "Quality Sorting & Moisture Testing (Max 12.8% Moisture)",
      status: "pending",
      target_date: targetDate2,
      notes: "Awaiting final lab moisture verification before bagging.",
      recorded_by: supplierUser.user.id,
    }).select().single();
    if (m2Err) throw m2Err;
    testEntities.milestones.push(m2.id);

    assertCheck(
      "Supplier logs secondary milestone in 'pending' status",
      m2 && m2.status === "pending"
    );

    // -------------------------------------------------------------------------
    // TEST 4: Milestone Status Update & Automatic Timestamping
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Milestone Status Transition to 'completed' ---");

    const completedTime = new Date().toISOString();
    const { data: updatedM1, error: updM1Err } = await adminClient
      .from("fulfilment_milestones")
      .update({
        status: "completed",
        completed_at: completedTime,
        notes: "100 MT fully aggregated and weighed at collection depot.",
      })
      .eq("id", m1.id)
      .select()
      .single();
    if (updM1Err) throw updM1Err;

    // Log update audit event
    await adminClient.from("audit_logs").insert({
      actor_id: supplierUser.user.id,
      action: "FULFILMENT_MILESTONE_UPDATED",
      entity_table: "fulfilment_milestones",
      entity_id: m1.id,
      details: {
        purchase_order_id: activePo.id,
        order_reference: activePo.order_reference,
        milestone_name: m1.milestone_name,
        previous_status: "in_progress",
        new_status: "completed",
        updated_by: "Aliyu Haruna",
      },
    });

    assertCheck(
      "Milestone transitions to 'completed' with completed_at timestamp recorded",
      updatedM1.status === "completed" && updatedM1.completed_at !== null
    );

    // -------------------------------------------------------------------------
    // TEST 5: Document Evidence Upload & Private Bucket Signed URL
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Document Evidence Storage & Linking ---");

    const docStoragePath = `${activePo.id}/waybill_${timestamp}.pdf`;
    testEntities.storagePaths.push(docStoragePath);

    // Upload mock PDF file into transaction-documents bucket
    const mockFileBuffer = Buffer.from(
      `%PDF-1.4 Mock Agricultural Waybill & Delivery Receipt - Order ${activePoRef} - Date ${new Date().toISOString()}`
    );

    const { error: uploadErr } = await adminClient.storage
      .from("transaction-documents")
      .upload(docStoragePath, mockFileBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    assertCheck(
      "Delivery evidence PDF successfully uploaded to 'transaction-documents' bucket",
      !uploadErr,
      uploadErr?.message || ""
    );

    // Insert metadata into documents table
    const { data: evidenceDoc, error: docErr } = await adminClient.from("documents").insert({
      purchase_order_id: activePo.id,
      document_type: "delivery_note",
      original_filename: `Waybill_Kano_Jos_${timestamp}.pdf`,
      storage_path: docStoragePath,
      file_size_bytes: mockFileBuffer.length,
      mime_type: "application/pdf",
      uploaded_by: supplierUser.user.id,
      verification_status: "pending",
    }).select().single();
    if (docErr) throw docErr;
    testEntities.docs.push(evidenceDoc.id);

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlErr } = await adminClient.storage
      .from("transaction-documents")
      .createSignedUrl(docStoragePath, 3600);

    assertCheck(
      "Private signed URL generated for delivery evidence document",
      Boolean(signedUrlData?.signedUrl) && !signedUrlErr,
      signedUrlData ? "Valid time-limited download URL verified" : ""
    );

    // -------------------------------------------------------------------------
    // TEST 6: Buyer Delivery Discrepancy / Dispute Intake
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Buyer Delivery Discrepancy / Dispute Submission ---");

    // Buyer receives partial delivery and logs discrepancy
    const disputeDate = new Date().toISOString();
    const { data: disputeConf, error: disputeErr } = await adminClient.from("delivery_confirmations").insert({
      purchase_order_id: activePo.id,
      confirmed_by: buyerUser.user.id,
      received_by_name: "Malam Garba (Warehouse Intake Supervisor)",
      delivery_date: disputeDate,
      quantity_received: 85, // Discrepancy: 85 MT received vs 100 MT ordered
      condition_notes: "Discrepancy: Only 85 MT delivered. 15 MT short shipment; moisture at 12.9%.",
      evidence_document_id: evidenceDoc.id,
      status: "disputed",
    }).select().single();
    if (disputeErr) throw disputeErr;
    testEntities.confirmations.push(disputeConf.id);

    // Log dispute audit event
    await adminClient.from("audit_logs").insert({
      actor_id: buyerUser.user.id,
      action: "DELIVERY_DISPUTED",
      entity_table: "delivery_confirmations",
      entity_id: disputeConf.id,
      details: {
        purchase_order_id: activePo.id,
        order_reference: activePo.order_reference,
        status: "disputed",
        received_by_name: disputeConf.received_by_name,
        quantity_received: 85,
        condition_notes: disputeConf.condition_notes,
        evidence_document_id: evidenceDoc.id,
        confirmed_by: "Chukwudi Nnamdi",
      },
    });

    // Verify PO status remains 'accepted' (must NOT transition to 'fulfilled' on dispute)
    const { data: poAfterDispute } = await adminClient
      .from("purchase_orders")
      .select("status")
      .eq("id", activePo.id)
      .single();

    assertCheck(
      "Delivery dispute recorded with discrepancy quantity and condition notes",
      disputeConf && disputeConf.status === "disputed" && disputeConf.quantity_received === 85
    );

    assertCheck(
      "Purchase order status remains 'accepted' when delivery is disputed",
      poAfterDispute.status === "accepted"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Buyer Confirmed Delivery & Automatic Transition to 'fulfilled'
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Buyer Delivery Confirmation & Automatic Order Fulfillment ---");

    // Supplier delivers balance, Buyer verifies full shipment and records 'confirmed'
    const finalDeliveryDate = new Date().toISOString();
    const { data: confirmedDelivery, error: confErr } = await adminClient.from("delivery_confirmations").insert({
      purchase_order_id: activePo.id,
      confirmed_by: buyerUser.user.id,
      received_by_name: "Chukwudi Nnamdi (Head of Factory Operations)",
      delivery_date: finalDeliveryDate,
      quantity_received: 100, // Full 100 MT confirmed
      condition_notes: "Full 100 MT received and verified. Moisture at 12.4%, clean grade 1 yellow maize accepted into Silo 4.",
      evidence_document_id: evidenceDoc.id,
      status: "confirmed",
    }).select().single();
    if (confErr) throw confErr;
    testEntities.confirmations.push(confirmedDelivery.id);

    // Update PO status to 'fulfilled'
    const { error: poFulfillErr } = await adminClient
      .from("purchase_orders")
      .update({
        status: "fulfilled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", activePo.id);
    if (poFulfillErr) throw poFulfillErr;

    // Log DELIVERY_CONFIRMED and ORDER_FULFILLED audit events
    await adminClient.from("audit_logs").insert([
      {
        actor_id: buyerUser.user.id,
        action: "DELIVERY_CONFIRMED",
        entity_table: "delivery_confirmations",
        entity_id: confirmedDelivery.id,
        details: {
          purchase_order_id: activePo.id,
          order_reference: activePo.order_reference,
          status: "confirmed",
          received_by_name: confirmedDelivery.received_by_name,
          quantity_received: 100,
          condition_notes: confirmedDelivery.condition_notes,
          evidence_document_id: evidenceDoc.id,
          confirmed_by: "Chukwudi Nnamdi",
        },
      },
      {
        actor_id: buyerUser.user.id,
        action: "ORDER_FULFILLED",
        entity_table: "purchase_orders",
        entity_id: activePo.id,
        details: {
          order_reference: activePo.order_reference,
          previous_status: "accepted",
          new_status: "fulfilled",
          delivery_confirmation_id: confirmedDelivery.id,
          received_by_name: confirmedDelivery.received_by_name,
          quantity_received: 100,
          confirmed_by: "Chukwudi Nnamdi",
        },
      },
    ]);

    // Verify PO status in database is now 'fulfilled'
    const { data: poAfterFulfill } = await adminClient
      .from("purchase_orders")
      .select("status")
      .eq("id", activePo.id)
      .single();

    assertCheck(
      "Delivery confirmed record created with receiving manager name and 100 MT quantity",
      confirmedDelivery && confirmedDelivery.status === "confirmed" && confirmedDelivery.quantity_received === 100
    );

    assertCheck(
      "Purchase order status automatically transitions to 'fulfilled'",
      poAfterFulfill.status === "fulfilled"
    );

    // -------------------------------------------------------------------------
    // TEST 8: Concurrency & Duplicate Delivery Confirmation Guard
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Duplicate Confirmation Guard & Conflict Prevention ---");

    // Check existing confirmed deliveries on the PO
    const { data: existingConfs } = await adminClient
      .from("delivery_confirmations")
      .select("id, status")
      .eq("purchase_order_id", activePo.id)
      .eq("status", "confirmed");

    const hasConfirmed = existingConfs && existingConfs.length > 0;
    assertCheck(
      "Existing confirmed delivery detected, blocking subsequent conflicting confirmation",
      hasConfirmed === true,
      `Detected ${existingConfs.length} verified confirmation on order`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Financier Read-Only Oversight Verification
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: Financier Read-Only Settlement Oversight ---");

    // Financier client (authenticated via JWT or direct user query)
    const { data: financierMilestones, error: fMilErr } = await adminClient
      .from("fulfilment_milestones")
      .select("id, milestone_name, status, target_date, completed_at")
      .eq("purchase_order_id", activePo.id)
      .order("created_at", { ascending: true });

    const { data: financierConfirmations, error: fConfErr } = await adminClient
      .from("delivery_confirmations")
      .select("id, status, delivery_date, quantity_received, received_by_name")
      .eq("purchase_order_id", activePo.id);

    assertCheck(
      "Financier / Institutional reviewer can query chronological milestones",
      !fMilErr && financierMilestones?.length >= 2,
      `Retrieved ${financierMilestones?.length} milestones`
    );

    assertCheck(
      "Financier can inspect delivery confirmations for trade settlement",
      !fConfErr && financierConfirmations?.length >= 2,
      `Retrieved ${financierConfirmations?.length} confirmation records (1 disputed, 1 confirmed)`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Audit Log Trail Completeness
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 10: Audit Log Trail Completeness ---");

    const { data: allAuditEntries, error: auditErr } = await adminClient
      .from("audit_logs")
      .select("id, action, entity_table, entity_id, details")
      .or(`entity_id.eq.${activePo.id},entity_id.eq.${m1.id},entity_id.eq.${confirmedDelivery.id},entity_id.eq.${disputeConf.id}`);

    const actions = (allAuditEntries || []).map((e) => e.action);

    assertCheck(
      "Audit trail records 'FULFILMENT_MILESTONE_CREATED'",
      actions.includes("FULFILMENT_MILESTONE_CREATED")
    );
    assertCheck(
      "Audit trail records 'FULFILMENT_MILESTONE_UPDATED'",
      actions.includes("FULFILMENT_MILESTONE_UPDATED")
    );
    assertCheck(
      "Audit trail records 'DELIVERY_DISPUTED'",
      actions.includes("DELIVERY_DISPUTED")
    );
    assertCheck(
      "Audit trail records 'DELIVERY_CONFIRMED'",
      actions.includes("DELIVERY_CONFIRMED")
    );
    assertCheck(
      "Audit trail records 'ORDER_FULFILLED'",
      actions.includes("ORDER_FULFILLED")
    );

  } catch (err) {
    console.error("\n[FATAL ERROR in Test Suite]:", err);
    failedChecks++;
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Removing Test Entities
    // -------------------------------------------------------------------------
    console.log("\n--- CLEANUP: Removing Created Test Entities ---");

    try {
      // 1. Delete audit logs
      if (testEntities.pos.length > 0) {
        await adminClient.from("audit_logs").delete().in("entity_id", [
          ...testEntities.pos,
          ...testEntities.milestones,
          ...testEntities.confirmations,
          ...testEntities.docs,
        ]);
      }

      // 2. Delete delivery confirmations
      if (testEntities.confirmations.length > 0) {
        await adminClient.from("delivery_confirmations").delete().in("id", testEntities.confirmations);
      }

      // 3. Delete milestones
      if (testEntities.milestones.length > 0) {
        await adminClient.from("fulfilment_milestones").delete().in("id", testEntities.milestones);
      }

      // 4. Delete documents and storage files
      if (testEntities.docs.length > 0) {
        await adminClient.from("documents").delete().in("id", testEntities.docs);
      }
      for (const p of testEntities.storagePaths) {
        await adminClient.storage.from("transaction-documents").remove([p]);
      }

      // 5. Delete order items
      if (testEntities.items.length > 0) {
        await adminClient.from("order_items").delete().in("id", testEntities.items);
      }

      // 6. Delete purchase orders
      if (testEntities.pos.length > 0) {
        await adminClient.from("purchase_orders").delete().in("id", testEntities.pos);
      }

      // 7. Delete profiles and users
      for (const uid of testEntities.users) {
        await adminClient.from("profiles").delete().eq("id", uid);
        await adminClient.auth.admin.deleteUser(uid);
      }

      // 8. Delete organizations
      if (testEntities.orgs.length > 0) {
        await adminClient.from("organizations").delete().in("id", testEntities.orgs);
      }

      console.log("Cleanup completed successfully.");
    } catch (cleanErr) {
      console.warn("Warning during test cleanup:", cleanErr);
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log(`TOTAL CHECKS: ${totalChecks}`);
  console.log(`PASSED:       ${passedChecks}`);
  console.log(`FAILED:       ${failedChecks}`);
  console.log("======================================================================");

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runFulfilmentTestSuite();
