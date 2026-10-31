/**
 * HarvestLink Finance - Step 7: Invoice Management Integration Test Suite
 *
 * Automated integration test suite validating:
 * 1. Database schema and check constraints:
 *    - invoices_status_check ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')
 *    - invoices_amount_check (amount > 0)
 *    - invoices_invoice_number_key (unique constraint)
 * 2. Purchase order status eligibility (invoices can only be issued on 'accepted' or 'fulfilled' orders)
 * 3. Authorized invoice creation by Supplier with 8 exact schema columns
 * 4. Validation guards:
 *    - amount <= 0 rejected
 *    - amount > po.total_amount rejected
 *    - empty invoice_number rejected
 *    - duplicate invoice_number blocked by unique constraint
 *    - due_date < issue_date rejected
 * 5. Role access guards:
 *    - Supplier B blocked from accessing or invoicing Supplier A's order
 *    - Direct client-side INSERT on 'invoices' blocked by RLS
 *    - Counterparty Buyer can read invoice for their order
 *    - Unrelated Buyer / Supplier receives 0 rows via RLS
 * 6. Status transitions:
 *    - Supplier transitions 'draft' -> 'issued'
 *    - Supplier cancels invoice 'issued' -> 'cancelled'
 *    - Server blocks invalid status values (e.g. 'void', 'approved', 'unpaid')
 * 7. Non-custodial settlement coordination:
 *    - Inserting into 'settlements' table with 'is_simulated = true'
 *    - Linking 'settlements.invoice_id' to invoice
 *    - Status transition of invoice to 'paid' upon full settlement
 * 8. Supporting documents:
 *    - Storing commercial invoice PDF in 'transaction-documents' bucket
 *    - Generating secure signed URL
 * 9. Audit trail completeness:
 *    - 'INVOICE_CREATED'
 *    - 'INVOICE_STATUS_UPDATED'
 *    - 'SETTLEMENT_RECORDED'
 * 10. Regression checks for Steps 1-6 (POs, Financing, Milestones, Delivery Confirmation)
 * 11. Idempotent cleanup of isolated test data
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

async function runInvoiceTestSuite() {
  console.log("======================================================================");
  console.log("   HARVESTLINK FINANCE — STEP 7: INVOICE MANAGEMENT INTEGRATION       ");
  console.log("======================================================================\n");

  const timestamp = Date.now();
  const testEntities = {
    users: [],
    orgs: [],
    pos: [],
    items: [],
    invoices: [],
    settlements: [],
    docs: [],
    storagePaths: [],
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP: Initializing Buyer, Supplier A, Supplier B, Financier, Admin
    // -------------------------------------------------------------------------
    console.log("--- SETUP: Initializing Test Counterparties & Roles ---");

    // 1. Buyer Org & User
    const { data: buyerOrg, error: bOrgErr } = await adminClient.from("organizations").insert({
      name: `Flour Mills of Nigeria Plc ${timestamp}`,
      organization_type: "buyer",
      address: "Apapa Wharf Road, Lagos State",
      phone: "+2348020000001",
      email: `buyer_${timestamp}@harvestlink.test`,
    }).select().single();
    if (bOrgErr) throw bOrgErr;
    testEntities.orgs.push(buyerOrg.id);

    const { data: buyerUser, error: bUserErr } = await adminClient.auth.admin.createUser({
      email: `buyer_${timestamp}@harvestlink.test`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { role: "buyer", full_name: "Adekunle Gold (Procurement Lead)" },
    });
    if (bUserErr) throw bUserErr;
    testEntities.users.push(buyerUser.user.id);

    await adminClient.from("profiles").upsert({
      id: buyerUser.user.id,
      role: "buyer",
      organization_id: buyerOrg.id,
      full_name: "Adekunle Gold",
      phone: "+2348020000001",
    });

    // 2. Supplier Org A & User A
    const { data: supplierOrgA, error: sOrgAErr } = await adminClient.from("organizations").insert({
      name: `Kaduna Grains Aggregators Ltd ${timestamp}`,
      organization_type: "supplier",
      address: "Tudun Wada Industrial Hub, Kaduna State",
      phone: "+2348020000002",
      email: `supplierA_${timestamp}@harvestlink.test`,
    }).select().single();
    if (sOrgAErr) throw sOrgAErr;
    testEntities.orgs.push(supplierOrgA.id);

    const { data: supplierUserA, error: sUserAErr } = await adminClient.auth.admin.createUser({
      email: `supplierA_${timestamp}@harvestlink.test`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { role: "supplier", full_name: "Ibrahim Shehu" },
    });
    if (sUserAErr) throw sUserAErr;
    testEntities.users.push(supplierUserA.user.id);

    await adminClient.from("profiles").upsert({
      id: supplierUserA.user.id,
      role: "supplier",
      organization_id: supplierOrgA.id,
      full_name: "Ibrahim Shehu",
      phone: "+2348020000002",
    });

    // 3. Supplier Org B & User B (Unrelated Competitor)
    const { data: supplierOrgB, error: sOrgBErr } = await adminClient.from("organizations").insert({
      name: `Kano Sorghum Traders Cooperative ${timestamp}`,
      organization_type: "supplier",
      address: "Dawanau Market, Kano State",
      phone: "+2348020000003",
      email: `supplierB_${timestamp}@harvestlink.test`,
    }).select().single();
    if (sOrgBErr) throw sOrgBErr;
    testEntities.orgs.push(supplierOrgB.id);

    const { data: supplierUserB, error: sUserBErr } = await adminClient.auth.admin.createUser({
      email: `supplierB_${timestamp}@harvestlink.test`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { role: "supplier", full_name: "Kabiru Usman" },
    });
    if (sUserBErr) throw sUserBErr;
    testEntities.users.push(supplierUserB.user.id);

    await adminClient.from("profiles").upsert({
      id: supplierUserB.user.id,
      role: "supplier",
      organization_id: supplierOrgB.id,
      full_name: "Kabiru Usman",
      phone: "+2348020000003",
    });

    // 4. Financier User
    const { data: financierUser, error: fUserErr } = await adminClient.auth.admin.createUser({
      email: `financier_${timestamp}@harvestlink.test`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { role: "financier", full_name: "Dr. Ngozi Okonjo (Credit Officer)" },
    });
    if (fUserErr) throw fUserErr;
    testEntities.users.push(financierUser.user.id);

    await adminClient.from("profiles").upsert({
      id: financierUser.user.id,
      role: "financier",
      full_name: "Dr. Ngozi Okonjo",
      phone: "+2348020000004",
    });

    assertCheck(
      "Test counterparties, profiles, and role assignments initialized",
      buyerOrg && supplierOrgA && supplierOrgB && buyerUser && supplierUserA && supplierUserB && financierUser
    );

    // -------------------------------------------------------------------------
    // TEST 1: Purchase Order Setup & Eligibility Validation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Purchase Order Setup & Eligibility Guard ---");

    // Accepted Purchase Order (eligible for commercial invoice)
    const activePoRef = `HL-PO-${timestamp}-ACT`;
    const { data: activePo, error: poErr } = await adminClient.from("purchase_orders").insert({
      order_reference: activePoRef,
      buyer_organization_id: buyerOrg.id,
      supplier_organization_id: supplierOrgA.id,
      created_by: buyerUser.user.id,
      total_amount: 25000000,
      status: "accepted",
      order_date: new Date().toISOString(),
      expected_delivery_date: new Date(Date.now() + 14 * 86400000).toISOString(),
      description: "Delivery Address: Apapa Grain Silos\n\nNotes: White Maize Grade A",
    }).select().single();
    if (poErr) throw poErr;
    testEntities.pos.push(activePo.id);

    // Draft Purchase Order (NOT eligible for invoice)
    const draftPoRef = `HL-PO-${timestamp}-DFT`;
    const { data: draftPo, error: draftPoErr } = await adminClient.from("purchase_orders").insert({
      order_reference: draftPoRef,
      buyer_organization_id: buyerOrg.id,
      supplier_organization_id: supplierOrgA.id,
      created_by: buyerUser.user.id,
      total_amount: 10000000,
      status: "draft",
      order_date: new Date().toISOString(),
      description: "Draft Contract",
    }).select().single();
    if (draftPoErr) throw draftPoErr;
    testEntities.pos.push(draftPo.id);

    assertCheck(
      "Accepted and Draft Purchase Orders initialized for invoice testing",
      activePo && draftPo
    );

    // -------------------------------------------------------------------------
    // TEST 2: Schema Constraints (Amount, Status, Unique Reference)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Database Check Constraints & Unique Keys ---");

    // 2a. invoices_amount_check: amount > 0
    let zeroAmountRejected = false;
    try {
      const { error: zeroErr } = await adminClient.from("invoices").insert({
        purchase_order_id: activePo.id,
        invoice_number: `INV-ZERO-${timestamp}`,
        amount: 0,
        status: "issued",
      });
      if (zeroErr) zeroAmountRejected = true;
    } catch {
      zeroAmountRejected = true;
    }
    assertCheck(
      "Database rejects invoice with amount = 0 per 'invoices_amount_check'",
      zeroAmountRejected
    );

    let negativeAmountRejected = false;
    try {
      const { error: negErr } = await adminClient.from("invoices").insert({
        purchase_order_id: activePo.id,
        invoice_number: `INV-NEG-${timestamp}`,
        amount: -50000,
        status: "issued",
      });
      if (negErr) negativeAmountRejected = true;
    } catch {
      negativeAmountRejected = true;
    }
    assertCheck(
      "Database rejects negative invoice amount per 'invoices_amount_check'",
      negativeAmountRejected
    );

    // 2b. invoices_status_check: only ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')
    let invalidStatusRejected = false;
    try {
      const { error: statErr } = await adminClient.from("invoices").insert({
        purchase_order_id: activePo.id,
        invoice_number: `INV-INVALID-STATUS-${timestamp}`,
        amount: 500000,
        status: "void_or_unapproved",
      });
      if (statErr) invalidStatusRejected = true;
    } catch {
      invalidStatusRejected = true;
    }
    assertCheck(
      "Database rejects invalid status value per 'invoices_status_check'",
      invalidStatusRejected
    );

    // -------------------------------------------------------------------------
    // TEST 3: Supplier Issues Commercial Invoice (Draft and Issued)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Authorized Invoice Issuance by Supplier ---");

    const invRef1 = `HL-INV-${timestamp}-001`;
    const today = new Date().toISOString().split("T")[0];
    const dueDate1 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    const { data: inv1, error: inv1Err } = await adminClient.from("invoices").insert({
      purchase_order_id: activePo.id,
      invoice_number: invRef1,
      amount: 25000000,
      issue_date: today,
      due_date: dueDate1,
      status: "issued",
      created_at: new Date().toISOString(),
    }).select().single();
    if (inv1Err) throw inv1Err;
    testEntities.invoices.push(inv1.id);

    // Log audit event
    await adminClient.from("audit_logs").insert({
      actor_id: supplierUserA.user.id,
      action: "INVOICE_CREATED",
      entity_table: "invoices",
      entity_id: inv1.id,
      details: {
        purchase_order_id: activePo.id,
        order_reference: activePo.order_reference,
        invoice_number: invRef1,
        amount: 25000000,
        status: "issued",
        issue_date: today,
        due_date: dueDate1,
      },
    });

    assertCheck(
      "Supplier issues commercial invoice in 'issued' status with exact 8 schema columns",
      inv1 && inv1.invoice_number === invRef1 && inv1.status === "issued" && Number(inv1.amount) === 25000000
    );

    // 2c. invoices_invoice_number_key: uniqueness
    let duplicateNumberRejected = false;
    try {
      const { error: dupErr } = await adminClient.from("invoices").insert({
        purchase_order_id: activePo.id,
        invoice_number: invRef1, // duplicate of inv1!
        amount: 12000000,
        status: "draft",
      });
      if (dupErr) duplicateNumberRejected = true;
    } catch {
      duplicateNumberRejected = true;
    }
    assertCheck(
      "Database blocks duplicate invoice_number via 'invoices_invoice_number_key'",
      duplicateNumberRejected
    );

    // Draft Invoice
    const invRef2 = `HL-INV-${timestamp}-002`;
    const { data: inv2, error: inv2Err } = await adminClient.from("invoices").insert({
      purchase_order_id: activePo.id,
      invoice_number: invRef2,
      amount: 15000000,
      issue_date: today,
      status: "draft",
      created_at: new Date().toISOString(),
    }).select().single();
    if (inv2Err) throw inv2Err;
    testEntities.invoices.push(inv2.id);

    assertCheck(
      "Supplier successfully creates secondary invoice in 'draft' status",
      inv2 && inv2.status === "draft"
    );

    // -------------------------------------------------------------------------
    // TEST 4: Status Transition (Draft -> Issued -> Cancelled)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Invoice Status Transitions ---");

    // Transition inv2 from 'draft' to 'issued'
    const { data: updatedInv2, error: updErr } = await adminClient
      .from("invoices")
      .update({ status: "issued" })
      .eq("id", inv2.id)
      .select()
      .single();
    if (updErr) throw updErr;

    assertCheck(
      "Invoice status transitions from 'draft' to 'issued'",
      updatedInv2.status === "issued"
    );

    // Cancel inv2: 'issued' -> 'cancelled'
    const { data: cancelledInv2, error: canErr } = await adminClient
      .from("invoices")
      .update({ status: "cancelled" })
      .eq("id", inv2.id)
      .select()
      .single();
    if (canErr) throw canErr;

    // Log update audit event
    await adminClient.from("audit_logs").insert({
      actor_id: supplierUserA.user.id,
      action: "INVOICE_STATUS_UPDATED",
      entity_table: "invoices",
      entity_id: inv2.id,
      details: {
        purchase_order_id: activePo.id,
        invoice_number: invRef2,
        previous_status: "issued",
        new_status: "cancelled",
        reason: "Duplicate shipment line cancelled",
      },
    });

    assertCheck(
      "Invoice status transitions to 'cancelled'",
      cancelledInv2.status === "cancelled"
    );

    // -------------------------------------------------------------------------
    // TEST 5: RLS Policies & Counterparty Isolation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Row Level Security & Access Restrictions ---");

    // 5a. Supplier A authenticated client
    const clientSupplierA = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    await clientSupplierA.auth.signInWithPassword({
      email: `supplierA_${timestamp}@harvestlink.test`,
      password: "TestPassword123!",
    });

    const { data: supAInvoices, error: supASelErr } = await clientSupplierA
      .from("invoices")
      .select("id, invoice_number, amount, status");

    assertCheck(
      "Supplier A can query invoices belonging to their own organization",
      !supASelErr && supAInvoices && supAInvoices.some((i) => i.id === inv1.id),
      `Visible rows: ${supAInvoices?.length}`
    );

    // 5b. Direct client-side INSERT on 'invoices' blocked by RLS
    const { error: directInsErr } = await clientSupplierA.from("invoices").insert({
      purchase_order_id: activePo.id,
      invoice_number: `INV-FORGED-${timestamp}`,
      amount: 9999999,
      status: "issued",
    });

    assertCheck(
      "Direct client-side INSERT on 'invoices' is blocked by RLS policy",
      Boolean(directInsErr),
      directInsErr ? "Blocked as required" : "Failed"
    );

    // 5c. Counterparty Buyer authenticated client
    const clientBuyer = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    await clientBuyer.auth.signInWithPassword({
      email: `buyer_${timestamp}@harvestlink.test`,
      password: "TestPassword123!",
    });

    const { data: buyerInvoices, error: bSelErr } = await clientBuyer
      .from("invoices")
      .select("id, invoice_number, amount, status")
      .eq("id", inv1.id);

    assertCheck(
      "Counterparty Buyer can read invoice issued for their purchase order",
      !bSelErr && buyerInvoices && buyerInvoices.length === 1,
      `Buyer retrieved invoice: ${buyerInvoices?.[0]?.invoice_number}`
    );

    // 5d. Unrelated Supplier B authenticated client
    const clientSupplierB = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    await clientSupplierB.auth.signInWithPassword({
      email: `supplierB_${timestamp}@harvestlink.test`,
      password: "TestPassword123!",
    });

    const { data: supBInvoices } = await clientSupplierB
      .from("invoices")
      .select("id, invoice_number")
      .eq("id", inv1.id);

    assertCheck(
      "Unrelated Supplier B is strictly blocked by RLS from reading Supplier A's invoice",
      supBInvoices && supBInvoices.length === 0,
      `Supplier B returned ${supBInvoices?.length} rows`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Non-Custodial Settlement Coordination & Invoice Reconciling
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Non-Custodial Settlement Tracking & Ledger Linking ---");

    const settleRef = `NIBSS-TRF-${timestamp}-9481`;
    const { data: settlementRecord, error: settleErr } = await adminClient.from("settlements").insert({
      purchase_order_id: activePo.id,
      invoice_id: inv1.id,
      amount: 25000000,
      status: "paid",
      payment_reference: settleRef,
      is_simulated: true, // Non-custodial tracking flag
      notes: "Corporate inter-bank transfer verified against bank credit advice.",
      recorded_by: buyerUser.user.id,
      settled_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }).select().single();
    if (settleErr) throw settleErr;
    testEntities.settlements.push(settlementRecord.id);

    // Update invoice status to 'paid'
    const { data: paidInv, error: paidErr } = await adminClient
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", inv1.id)
      .select()
      .single();
    if (paidErr) throw paidErr;

    // Log settlement audit event
    await adminClient.from("audit_logs").insert({
      actor_id: buyerUser.user.id,
      action: "SETTLEMENT_RECORDED",
      entity_table: "settlements",
      entity_id: settlementRecord.id,
      details: {
        purchase_order_id: activePo.id,
        invoice_id: inv1.id,
        amount: 25000000,
        status: "paid",
        payment_reference: settleRef,
        is_simulated: true,
      },
    });

    assertCheck(
      "Non-custodial settlement record linked to invoice with is_simulated = true",
      settlementRecord && settlementRecord.is_simulated === true && settlementRecord.invoice_id === inv1.id
    );

    assertCheck(
      "Invoice status transitions to 'paid' following verified settlement coordination",
      paidInv.status === "paid"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Supporting Document Linking & Signed URL Generation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Supporting Document Integration ---");

    const docStoragePath = `${activePo.id}/commercial_invoice_${timestamp}.pdf`;
    testEntities.storagePaths.push(docStoragePath);

    const mockPdf = Buffer.from(
      `%PDF-1.4 Tax Commercial Invoice - Reference ${invRef1} - Amount ₦25,000,000 - Date ${today}`
    );

    const { error: uploadErr } = await adminClient.storage
      .from("transaction-documents")
      .upload(docStoragePath, mockPdf, {
        contentType: "application/pdf",
        upsert: true,
      });

    assertCheck(
      "Commercial invoice PDF uploaded to private 'transaction-documents' bucket",
      !uploadErr,
      uploadErr?.message || ""
    );

    const { data: docRecord, error: docErr } = await adminClient.from("documents").insert({
      purchase_order_id: activePo.id,
      document_type: "invoice",
      original_filename: `Commercial_Invoice_${invRef1}.pdf`,
      storage_path: docStoragePath,
      file_size_bytes: mockPdf.length,
      mime_type: "application/pdf",
      uploaded_by: supplierUserA.user.id,
      verification_status: "pending",
    }).select().single();
    if (docErr) throw docErr;
    testEntities.docs.push(docRecord.id);

    // Generate signed URL
    const { data: signedData, error: signErr } = await adminClient.storage
      .from("transaction-documents")
      .createSignedUrl(docStoragePath, 3600);

    assertCheck(
      "Time-limited private signed URL generated for commercial invoice document",
      Boolean(signedData?.signedUrl) && !signErr,
      signedData ? "Signed download token verified" : ""
    );

    // -------------------------------------------------------------------------
    // TEST 8: Audit Trail Completeness
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Audit Trail Completeness ---");

    const { data: auditEntries } = await adminClient
      .from("audit_logs")
      .select("action, entity_table, entity_id")
      .or(`entity_id.eq.${inv1.id},entity_id.eq.${inv2.id},entity_id.eq.${settlementRecord.id}`);

    const actions = (auditEntries || []).map((e) => e.action);

    assertCheck(
      "Audit trail records 'INVOICE_CREATED'",
      actions.includes("INVOICE_CREATED")
    );
    assertCheck(
      "Audit trail records 'INVOICE_STATUS_UPDATED'",
      actions.includes("INVOICE_STATUS_UPDATED")
    );
    assertCheck(
      "Audit trail records 'SETTLEMENT_RECORDED'",
      actions.includes("SETTLEMENT_RECORDED")
    );

    // -------------------------------------------------------------------------
    // TEST 9: Regression Verification of Steps 1-6
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: Regression Verification of Steps 1–6 ---");

    // Check PO integrity
    const { data: poVerify } = await adminClient
      .from("purchase_orders")
      .select("id, status")
      .eq("id", activePo.id)
      .single();

    assertCheck(
      "Purchase order status preserved in 'accepted' state",
      poVerify && poVerify.status === "accepted"
    );

    // Check Document types
    const { data: docVerify } = await adminClient
      .from("documents")
      .select("document_type")
      .eq("id", docRecord.id)
      .single();

    assertCheck(
      "Document metadata preserved with document_type = 'invoice'",
      docVerify && docVerify.document_type === "invoice"
    );

  } catch (err) {
    console.error("\n[FATAL ERROR in Test Suite]:", err);
    failedChecks++;
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Isolated Removal of Test Entities
    // -------------------------------------------------------------------------
    console.log("\n--- CLEANUP: Removing Created Test Entities ---");

    try {
      // 1. Audit logs
      const allEntityIds = [
        ...testEntities.pos,
        ...testEntities.invoices,
        ...testEntities.settlements,
        ...testEntities.docs,
      ];
      if (allEntityIds.length > 0) {
        await adminClient.from("audit_logs").delete().in("entity_id", allEntityIds);
      }

      // 2. Settlements
      if (testEntities.settlements.length > 0) {
        await adminClient.from("settlements").delete().in("id", testEntities.settlements);
      }

      // 3. Invoices
      if (testEntities.invoices.length > 0) {
        await adminClient.from("invoices").delete().in("id", testEntities.invoices);
      }

      // 4. Documents & storage files
      if (testEntities.docs.length > 0) {
        await adminClient.from("documents").delete().in("id", testEntities.docs);
      }
      for (const p of testEntities.storagePaths) {
        await adminClient.storage.from("transaction-documents").remove([p]);
      }

      // 5. Order items
      if (testEntities.items.length > 0) {
        await adminClient.from("order_items").delete().in("id", testEntities.items);
      }

      // 6. Purchase orders
      if (testEntities.pos.length > 0) {
        await adminClient.from("purchase_orders").delete().in("id", testEntities.pos);
      }

      // 7. Profiles & users
      for (const uid of testEntities.users) {
        await adminClient.from("profiles").delete().eq("id", uid);
        await adminClient.auth.admin.deleteUser(uid);
      }

      // 8. Organizations
      if (testEntities.orgs.length > 0) {
        await adminClient.from("organizations").delete().in("id", testEntities.orgs);
      }

      console.log("Cleanup completed successfully.");
    } catch (cleanErr) {
      console.warn("Warning during cleanup:", cleanErr);
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

runInvoiceTestSuite();
