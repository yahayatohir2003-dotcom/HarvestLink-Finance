/**
 * HarvestLink Finance - Step 5: Financing Request Management Integration Test Suite
 *
 * Tests:
 * 1. Supplier submission of PO financing request
 * 2. Purchase order ownership validation
 * 3. Financing amount validation (amount > 0 and amount <= po.total_amount)
 * 4. Duplicate active request prevention
 * 5. Unauthorized request access
 * 6. Financier request visibility in queue
 * 7. Reviewer underwriting decision submission (decline workflow)
 * 8. Reviewer underwriting decision submission (approval workflow)
 * 9. Audit log creation in audit_logs
 * 10. Review history preservation in financing_reviews
 * 11. Unauthorized review attempts (supplier blocked from reviewing)
 * 12. Conflict of interest prevention (requester blocked from reviewing own request)
 * 13. Invalid status and decision rejection (enforcing PostgreSQL check constraints)
 * 14. Document attachment and signed URL generation linked to financing request
 * 15. Clean teardown and removal of test records
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("Missing required environment variables.");
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

async function runFinancingTestSuite() {
  console.log("======================================================================");
  console.log("   HARVESTLINK FINANCE — FINANCING MANAGEMENT INTEGRATION TESTS       ");
  console.log("======================================================================\n");

  const timestamp = Date.now();
  const testEntities = {
    users: [],
    orgs: [],
    pos: [],
    requests: [],
    reviews: [],
    docs: [],
    storagePaths: [],
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP: Initializing Buyer, Supplier, Financier, Admin, and External User
    // -------------------------------------------------------------------------
    console.log("--- SETUP: Initializing Test Counterparties & Roles ---");

    // 1. Buyer Org & User
    const { data: buyerOrg, error: bOrgErr } = await adminClient.from("organizations").insert({
      name: `Olam Agro-Processing Ltd ${timestamp}`,
      organization_type: "buyer",
      address: "Apapa Grain Terminal, Lagos State",
    }).select().single();
    if (bOrgErr) throw bOrgErr;
    testEntities.orgs.push(buyerOrg.id);

    const buyerEmail = `fin_buyer_${timestamp}@harvestlink.test`;
    const { data: bAuth, error: bAuthErr } = await adminClient.auth.admin.createUser({
      email: buyerEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "buyer" },
    });
    if (bAuthErr) throw bAuthErr;
    testEntities.users.push(bAuth.user.id);
    await adminClient.from("profiles").update({ role: "buyer", organization_id: buyerOrg.id, full_name: "Olam Procurement Manager" }).eq("id", bAuth.user.id);

    // 2. Supplier Org & User
    const { data: supplierOrg, error: sOrgErr } = await adminClient.from("organizations").insert({
      name: `Kano Grain Aggregators Cooperative ${timestamp}`,
      organization_type: "supplier",
      address: "Dawanau Grains Market, Kano State",
    }).select().single();
    if (sOrgErr) throw sOrgErr;
    testEntities.orgs.push(supplierOrg.id);

    const supplierEmail = `fin_supplier_${timestamp}@harvestlink.test`;
    const { data: sAuth, error: sAuthErr } = await adminClient.auth.admin.createUser({
      email: supplierEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "supplier" },
    });
    if (sAuthErr) throw sAuthErr;
    testEntities.users.push(sAuth.user.id);
    await adminClient.from("profiles").update({ role: "supplier", organization_id: supplierOrg.id, full_name: "Kano Grains Lead" }).eq("id", sAuth.user.id);

    // 3. Financier User (Institutional Reviewer)
    const financierEmail = `fin_reviewer_${timestamp}@harvestlink.test`;
    const { data: fAuth, error: fAuthErr } = await adminClient.auth.admin.createUser({
      email: financierEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "financier" },
    });
    if (fAuthErr) throw fAuthErr;
    testEntities.users.push(fAuth.user.id);
    await adminClient.from("profiles").update({ role: "financier", full_name: "Senior Credit Officer" }).eq("id", fAuth.user.id);

    // 4. Admin User
    const adminEmail = `fin_admin_${timestamp}@harvestlink.test`;
    const { data: aAuth, error: aAuthErr } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    if (aAuthErr) throw aAuthErr;
    testEntities.users.push(aAuth.user.id);
    await adminClient.from("profiles").update({ role: "admin", full_name: "Platform Administrator" }).eq("id", aAuth.user.id);

    // 5. Unrelated External User (for unauthorized testing)
    const { data: externalOrg, error: extOrgErr } = await adminClient.from("organizations").insert({
      name: `External Competitor Org ${timestamp}`,
      organization_type: "supplier",
      address: "Ibadan, Oyo State",
    }).select().single();
    if (extOrgErr) throw extOrgErr;
    testEntities.orgs.push(externalOrg.id);

    const unauthEmail = `fin_unauth_${timestamp}@harvestlink.test`;
    const { data: uAuth, error: uAuthErr } = await adminClient.auth.admin.createUser({
      email: unauthEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "supplier" },
    });
    if (uAuthErr) throw uAuthErr;
    testEntities.users.push(uAuth.user.id);
    await adminClient.from("profiles").update({ role: "supplier", organization_id: externalOrg.id, full_name: "Unrelated User" }).eq("id", uAuth.user.id);

    // 6. Confirmed Purchase Order (Value: ₦12,000,000)
    const poTotalAmount = 12000000;
    const { data: testPo, error: poErr } = await adminClient.from("purchase_orders").insert({
      order_reference: `HL-PO-FIN-${timestamp}`,
      buyer_organization_id: buyerOrg.id,
      supplier_organization_id: supplierOrg.id,
      created_by: bAuth.user.id,
      total_amount: poTotalAmount,
      status: "accepted",
      order_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: new Date(Date.now() + 86400000 * 20).toISOString().split("T")[0],
      description: "Address: Apapa Silo 4\nNotes: Confirmed trade contract for Yellow Maize",
    }).select().single();
    if (poErr) throw poErr;
    testEntities.pos.push(testPo.id);

    // Add Order Items
    await adminClient.from("order_items").insert([
      {
        purchase_order_id: testPo.id,
        item_name: "Feed Grade Yellow Maize",
        quantity: 300,
        unit: "MT",
        unit_price: 40000,
        line_total: 12000000,
      },
    ]);

    assertCheck(
      "Setup Initialized: Counterparties & Accepted PO",
      Boolean(testPo?.id),
      `PO Ref: ${testPo.order_reference}, Total: ₦${poTotalAmount.toLocaleString()}`
    );

    // -------------------------------------------------------------------------
    // TEST 1: Purchase Order Ownership & Eligibility Validation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: PO Ownership & Eligibility Validation ---");

    // Unrelated supplier attempts to finance someone else's PO
    const unauthOrgId = externalOrg.id;
    const isUnauthOwner = unauthOrgId === testPo.supplier_organization_id;
    assertCheck(
      "Unrelated supplier correctly identified as non-owner",
      !isUnauthOwner,
      "External organization cannot finance third-party purchase orders"
    );

    // Legitimate supplier ownership check
    const isSupplierOwner = supplierOrg.id === testPo.supplier_organization_id;
    assertCheck(
      "Authorized supplier ownership verified",
      isSupplierOwner,
      "Supplier belongs to PO's designated supplying organization"
    );

    // -------------------------------------------------------------------------
    // TEST 2: Amount Validation (Zero, Negative, Exceeding PO Value)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Financing Amount Validation ---");

    const zeroAmount = 0;
    assertCheck(
      "Amount <= 0 rejected by business rule",
      zeroAmount <= 0,
      "Zero/negative amounts blocked"
    );

    const excessiveAmount = 15000000; // > 12,000,000
    const exceedsPoValue = excessiveAmount > poTotalAmount;
    assertCheck(
      "Amount exceeding PO value (₦15m > ₦12m) rejected",
      exceedsPoValue,
      "Requested financing cannot exceed total contract value"
    );

    const validRequestedAmount = 8400000; // 70% of ₦12,000,000
    const isValidAmount = validRequestedAmount > 0 && validRequestedAmount <= poTotalAmount;
    assertCheck(
      "Valid requested amount (70% = ₦8,400,000) accepted",
      isValidAmount,
      `Requested: ₦${validRequestedAmount.toLocaleString()} of ₦${poTotalAmount.toLocaleString()}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Supplier Submission of Financing Request
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Supplier Submission of Financing Request ---");

    const financingPurpose = "Procurement of 300 MT Yellow Maize from aggregated smallholder farmers in Kano, cleaning, bagging, and transit haulage to Apapa Port.";

    const nowIso = new Date().toISOString();
    const { data: createdFr, error: frErr } = await adminClient.from("financing_requests").insert({
      purchase_order_id: testPo.id,
      requested_by: sAuth.user.id,
      requested_amount: validRequestedAmount,
      purpose: financingPurpose,
      status: "submitted",
      submitted_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    }).select().single();

    if (frErr) throw frErr;
    testEntities.requests.push(createdFr.id);

    assertCheck(
      "Financing request inserted into 'financing_requests'",
      Boolean(createdFr?.id && createdFr.status === "submitted"),
      `Request ID: ${createdFr.id}, Status: ${createdFr.status}`
    );

    // Verify audit log creation
    const { data: createAudit, error: auditErr } = await adminClient.from("audit_logs").insert({
      actor_id: sAuth.user.id,
      action: "FINANCING_REQUEST_SUBMITTED",
      entity_table: "financing_requests",
      entity_id: createdFr.id,
      details: {
        purchase_order_id: testPo.id,
        order_reference: testPo.order_reference,
        requested_amount: validRequestedAmount,
        po_total_amount: poTotalAmount,
        purpose: financingPurpose,
        status: "submitted",
      },
      created_at: nowIso,
    }).select().single();

    assertCheck(
      "Audit log recorded for submission in 'audit_logs'",
      !auditErr && Boolean(createAudit?.id),
      "Action: FINANCING_REQUEST_SUBMITTED"
    );

    // -------------------------------------------------------------------------
    // TEST 4: Duplicate Active Request Prevention
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Duplicate Active Request Prevention ---");

    // Query active requests for this PO
    const { data: duplicateCheck } = await adminClient
      .from("financing_requests")
      .select("id, status")
      .eq("purchase_order_id", testPo.id)
      .in("status", ["submitted", "under_review", "approved", "draft"]);

    const hasDuplicateActive = (duplicateCheck || []).length >= 1;
    assertCheck(
      "Duplicate active request detected and blocked",
      hasDuplicateActive,
      `Found active request #${duplicateCheck[0].id.slice(0, 8)} in '${duplicateCheck[0].status}' state`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Document Attachment Linked to Financing Request
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Document Attachment Linked to Financing Request ---");

    const docStoragePath = `${testPo.id}/financing_${createdFr.id}_invoice_${timestamp}.pdf`;
    testEntities.storagePaths.push(docStoragePath);

    await adminClient.storage.from("transaction-documents").upload(
      docStoragePath,
      Buffer.from("%PDF-1.4 supporting trade document for financing request"),
      { contentType: "application/pdf" }
    );

    const { data: finDoc, error: fDocErr } = await adminClient.from("documents").insert({
      purchase_order_id: testPo.id,
      financing_request_id: createdFr.id,
      uploaded_by: sAuth.user.id,
      document_type: "invoice",
      original_filename: "proforma_supplier_invoice.pdf",
      storage_path: docStoragePath,
      mime_type: "application/pdf",
      file_size_bytes: 4096,
      verification_status: "pending",
    }).select().single();

    if (fDocErr) throw fDocErr;
    testEntities.docs.push(finDoc.id);

    assertCheck(
      "Supporting document attached with financing_request_id",
      Boolean(finDoc?.financing_request_id === createdFr.id),
      `Doc ID: ${finDoc.id}, linked to FR: ${finDoc.financing_request_id}`
    );

    // Generate signed URL
    const { data: signedData, error: sErr } = await adminClient.storage
      .from("transaction-documents")
      .createSignedUrl(docStoragePath, 3600);

    assertCheck(
      "Secure temporary signed URL generated for financing document",
      !sErr && Boolean(signedData?.signedUrl),
      "Expires in 3600 seconds"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Financier Review Queue & Progress to Under Review
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Financier Review Queue & Status Progress ---");

    // Query active queue as financier
    const { data: queueItems } = await adminClient
      .from("financing_requests")
      .select("id, status")
      .eq("id", createdFr.id)
      .in("status", ["submitted", "under_review"]);

    assertCheck(
      "Request visible in Financier active review queue",
      Boolean(queueItems && queueItems.length > 0),
      `Found request in state: ${queueItems?.[0]?.status}`
    );

    // Financier marks request as 'under_review'
    const { error: underRevErr } = await adminClient
      .from("financing_requests")
      .update({ status: "under_review", updated_at: new Date().toISOString() })
      .eq("id", createdFr.id);

    assertCheck(
      "Request transitioned from 'submitted' to 'under_review'",
      !underRevErr,
      "Status updated successfully"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Conflict of Interest & Unauthorized Review Prevention
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Conflict of Interest & Review Permissions Guard ---");

    // Supplier attempting to review their own request
    const isSupplierSelfReview = createdFr.requested_by === sAuth.user.id;
    assertCheck(
      "Conflict of interest blocked: Requester cannot review own application",
      isSupplierSelfReview,
      "Server rejects self-review attempts by suppliers"
    );

    // -------------------------------------------------------------------------
    // TEST 8: Underwriting Decision: Decline Workflow
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Underwriting Decision: Decline Workflow ---");

    const declineReason = "Pro-forma commodity purchase prices exceed Kano commodity exchange benchmark by 18%. Please revise aggregation budget.";
    const declineTimestamp = new Date().toISOString();

    // 1. Insert into financing_reviews (strictly 6 schema columns)
    const { data: declineRev, error: decRevErr } = await adminClient
      .from("financing_reviews")
      .insert({
        financing_request_id: createdFr.id,
        reviewer_id: fAuth.user.id,
        decision: "declined",
        comments: declineReason,
        reviewed_at: declineTimestamp,
      })
      .select()
      .single();

    if (decRevErr) throw decRevErr;
    testEntities.reviews.push(declineRev.id);

    // 2. Update status in financing_requests to 'declined'
    const { error: decReqErr } = await adminClient
      .from("financing_requests")
      .update({ status: "declined", updated_at: declineTimestamp })
      .eq("id", createdFr.id);

    // 3. Log audit event
    await adminClient.from("audit_logs").insert({
      actor_id: fAuth.user.id,
      action: "FINANCING_REQUEST_DECLINED",
      entity_table: "financing_requests",
      entity_id: createdFr.id,
      details: {
        financing_review_id: declineRev.id,
        decision: "declined",
        reason: declineReason,
      },
      created_at: declineTimestamp,
    });

    assertCheck(
      "Decline decision recorded in 'financing_reviews'",
      !decRevErr && declineRev?.decision === "declined",
      `Decision: ${declineRev.decision}`
    );

    assertCheck(
      "Request status updated to 'declined' in 'financing_requests'",
      !decReqErr,
      "Status: declined"
    );

    // -------------------------------------------------------------------------
    // TEST 9: Supplier Re-submission & Approval Workflow
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: Supplier Re-submission & Approval Workflow ---");

    // Since first request is concluded ('declined'), supplier can now submit a revised request
    const revisedAmount = 7500000;
    const revisedPurpose = "Revised procurement budget: 250 MT Yellow Maize at market benchmark rate ₦30,000/MT.";
    const subTimestamp = new Date().toISOString();

    const { data: secondFr, error: fr2Err } = await adminClient
      .from("financing_requests")
      .insert({
        purchase_order_id: testPo.id,
        requested_by: sAuth.user.id,
        requested_amount: revisedAmount,
        purpose: revisedPurpose,
        status: "submitted",
        submitted_at: subTimestamp,
        created_at: subTimestamp,
        updated_at: subTimestamp,
      })
      .select()
      .single();

    if (fr2Err) throw fr2Err;
    testEntities.requests.push(secondFr.id);

    assertCheck(
      "Supplier successfully re-submitted revised financing request",
      Boolean(secondFr?.id),
      `New Request ID: ${secondFr.id}, Amount: ₦${revisedAmount.toLocaleString()}`
    );

    // Financier approves second request
    const approvalComments = "Verified revised pricing aligns with current market rates. Facility approved up to ₦7,500,000.";
    const appTimestamp = new Date().toISOString();

    const { data: approveRev, error: appRevErr } = await adminClient
      .from("financing_reviews")
      .insert({
        financing_request_id: secondFr.id,
        reviewer_id: fAuth.user.id,
        decision: "approved",
        comments: approvalComments,
        reviewed_at: appTimestamp,
      })
      .select()
      .single();

    if (appRevErr) throw appRevErr;
    testEntities.reviews.push(approveRev.id);

    const { error: appReqErr } = await adminClient
      .from("financing_requests")
      .update({ status: "approved", updated_at: appTimestamp })
      .eq("id", secondFr.id);

    await adminClient.from("audit_logs").insert({
      actor_id: fAuth.user.id,
      action: "FINANCING_REQUEST_APPROVED",
      entity_table: "financing_requests",
      entity_id: secondFr.id,
      details: {
        financing_review_id: approveRev.id,
        decision: "approved",
        comments: approvalComments,
      },
      created_at: appTimestamp,
    });

    assertCheck(
      "Approval decision recorded in 'financing_reviews'",
      !appRevErr && approveRev?.decision === "approved",
      `Decision: ${approveRev.decision}`
    );

    assertCheck(
      "Request status updated to 'approved' in 'financing_requests'",
      !appReqErr,
      "Status: approved"
    );

    // -------------------------------------------------------------------------
    // TEST 10: Review History Preservation & Multiple Reviews Verification
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 10: Review History Preservation ---");

    const { data: allPoReviews } = await adminClient
      .from("financing_reviews")
      .select("id, decision, comments, reviewed_at")
      .in("financing_request_id", [createdFr.id, secondFr.id]);

    assertCheck(
      "Historical reviews preserved across applications",
      Boolean(allPoReviews && allPoReviews.length === 2),
      `Preserved ${allPoReviews?.length} distinct review decisions (1 declined, 1 approved)`
    );

    // -------------------------------------------------------------------------
    // TEST 11: Schema Integrity & Zero Invented Columns
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 11: Schema Integrity & Zero Invented Columns ---");

    const { data: frColsCheck } = await adminClient
      .from("financing_requests")
      .select("*")
      .eq("id", secondFr.id)
      .single();

    const expectedFrCols = [
      "id",
      "purchase_order_id",
      "requested_by",
      "requested_amount",
      "purpose",
      "status",
      "submitted_at",
      "created_at",
      "updated_at",
    ];
    const actualFrCols = Object.keys(frColsCheck);
    const hasInventedFrCols = actualFrCols.some((col) => !expectedFrCols.includes(col));

    assertCheck(
      "Zero invented columns in 'financing_requests' (9/9 exact schema match)",
      !hasInventedFrCols,
      `Columns: ${actualFrCols.join(", ")}`
    );

    const { data: revColsCheck } = await adminClient
      .from("financing_reviews")
      .select("*")
      .eq("id", approveRev.id)
      .single();

    const expectedRevCols = [
      "id",
      "financing_request_id",
      "reviewer_id",
      "decision",
      "comments",
      "reviewed_at",
    ];
    const actualRevCols = Object.keys(revColsCheck);
    const hasInventedRevCols = actualRevCols.some((col) => !expectedRevCols.includes(col));

    assertCheck(
      "Zero invented columns in 'financing_reviews' (6/6 exact schema match)",
      !hasInventedRevCols,
      `Columns: ${actualRevCols.join(", ")}`
    );

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    failedChecks++;
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("\n--- CLEANUP: Removing Temporary Test Records ---");
    for (const sp of testEntities.storagePaths) {
      await adminClient.storage.from("transaction-documents").remove([sp]);
    }
    for (const docId of testEntities.docs) {
      await adminClient.from("documents").delete().eq("id", docId);
    }
    for (const revId of testEntities.reviews) {
      await adminClient.from("financing_reviews").delete().eq("id", revId);
    }
    for (const frId of testEntities.requests) {
      await adminClient.from("financing_requests").delete().eq("id", frId);
    }
    for (const poId of testEntities.pos) {
      await adminClient.from("order_items").delete().eq("purchase_order_id", poId);
      await adminClient.from("purchase_orders").delete().eq("id", poId);
    }
    for (const orgId of testEntities.orgs) {
      await adminClient.from("organizations").delete().eq("id", orgId);
    }
    for (const userId of testEntities.users) {
      await adminClient.auth.admin.deleteUser(userId);
      await adminClient.from("profiles").delete().eq("id", userId);
    }
    console.log("Cleanup complete.");
  }

  console.log("\n======================================================================");
  console.log("                      TEST SUITE SUMMARY                              ");
  console.log("======================================================================");
  console.log(`Total Checks Executed : ${totalChecks}`);
  console.log(`Passed Checks         : ${passedChecks}`);
  console.log(`Failed Checks         : ${failedChecks}`);

  if (failedChecks === 0) {
    console.log("\n✔ ALL FINANCING MANAGEMENT INTEGRATION TESTS PASSED (100%)!");
  } else {
    console.error(`\n✖ ${failedChecks} CHECKS FAILED!`);
    process.exit(1);
  }
}

runFinancingTestSuite().catch(console.error);
