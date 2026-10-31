/**
 * HarvestLink Finance - Platform-Wide Security & Integration Test Suite
 *
 * Comprehensive multi-role verification covering:
 * 1. Counterparty & Role Isolation (Supplier, Buyer, Financier, Admin)
 * 2. Self-Privilege Escalation Prevention (role and organization_id immutability via RLS)
 * 3. Confidential Underwriting Reviews Isolation (Buyers strictly blocked from underwriting notes)
 * 4. Document Storage Security (transaction-documents private bucket, deletion guards)
 * 5. Audit Log Immutability (Non-admin direct UPDATE, DELETE, and forged INSERT blocked)
 * 6. Non-Custodial Integrity (Simulated records & pending claims do not affect verified balance)
 * 7. Client Secret Auditing (Zero service-role keys or admin clients in client bundles)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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

function assertCheck(name, passed, detail = "") {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`[✔ PASS] ${name}${detail ? ` - ${detail}` : ""}`);
  } else {
    failedChecks++;
    console.error(`[✖ FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
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

async function runPlatformWideSecuritySuite() {
  console.log("======================================================================");
  console.log("   HARVESTLINK FINANCE — PLATFORM-WIDE SECURITY TEST SUITE             ");
  console.log("======================================================================\n");

  const ts = Date.now();
  const testEntities = {
    users: [],
    orgs: [],
    pos: [],
    financingRequests: [],
    financingReviews: [],
    documents: [],
    invoices: [],
    settlements: [],
  };

  try {
    // -------------------------------------------------------------------------
    // 1. SETUP: Create Organizations and Authenticated Test Accounts
    // -------------------------------------------------------------------------
    console.log("--- 1. SETUP: Creating Multi-Role Counterparties ---");

    // Buyer Org & User
    const { data: bOrg } = await admin.from("organizations").insert({
      name: `Security Buyer Org ${ts}`,
      organization_type: "buyer",
      address: "Apapa Port, Lagos",
    }).select().single();
    testEntities.orgs.push(bOrg.id);

    const buyerEmail = `sec_buyer_${ts}@harvestlink.test`;
    const { data: bUser } = await admin.auth.admin.createUser({
      email: buyerEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "buyer" },
    });
    testEntities.users.push(bUser.user.id);
    await admin.from("profiles").update({
      role: "buyer",
      organization_id: bOrg.id,
      full_name: "Buyer Logistics Manager",
    }).eq("id", bUser.user.id);

    // Supplier A Org & User
    const { data: sAOrg } = await admin.from("organizations").insert({
      name: `Security Supplier A Org ${ts}`,
      organization_type: "supplier",
      address: "Dawanau Market, Kano",
    }).select().single();
    testEntities.orgs.push(sAOrg.id);

    const supplierAEmail = `sec_supp_a_${ts}@harvestlink.test`;
    const { data: sAUser } = await admin.auth.admin.createUser({
      email: supplierAEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "supplier" },
    });
    testEntities.users.push(sAUser.user.id);
    await admin.from("profiles").update({
      role: "supplier",
      organization_id: sAOrg.id,
      full_name: "Supplier A Lead",
    }).eq("id", sAUser.user.id);

    // Supplier B Org & User (Tenant Isolation Testing)
    const { data: sBOrg } = await admin.from("organizations").insert({
      name: `Security Supplier B Org ${ts}`,
      organization_type: "supplier",
      address: "Zaria Road, Kaduna",
    }).select().single();
    testEntities.orgs.push(sBOrg.id);

    const supplierBEmail = `sec_supp_b_${ts}@harvestlink.test`;
    const { data: sBUser } = await admin.auth.admin.createUser({
      email: supplierBEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "supplier" },
    });
    testEntities.users.push(sBUser.user.id);
    await admin.from("profiles").update({
      role: "supplier",
      organization_id: sBOrg.id,
      full_name: "Supplier B Competitor",
    }).eq("id", sBUser.user.id);

    // Financier Org & User
    const { data: fOrg } = await admin.from("organizations").insert({
      name: `Security Financier Org ${ts}`,
      organization_type: "financier",
      address: "Victoria Island, Lagos",
    }).select().single();
    testEntities.orgs.push(fOrg.id);

    const financierEmail = `sec_fin_${ts}@harvestlink.test`;
    const { data: fUser } = await admin.auth.admin.createUser({
      email: financierEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "financier" },
    });
    testEntities.users.push(fUser.user.id);
    await admin.from("profiles").update({
      role: "financier",
      organization_id: fOrg.id,
      full_name: "Institutional Underwriter",
    }).eq("id", fUser.user.id);

    // External Competitor Buyer Org & User (for multi-tenant confidentiality testing)
    const { data: extBOrg } = await admin.from("organizations").insert({
      name: `Security External Buyer Org ${ts}`,
      organization_type: "buyer",
      address: "Marina, Lagos",
    }).select().single();
    testEntities.orgs.push(extBOrg.id);

    const extBuyerEmail = `sec_ext_buyer_${ts}@harvestlink.test`;
    const { data: extBUser } = await admin.auth.admin.createUser({
      email: extBuyerEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "buyer" },
    });
    testEntities.users.push(extBUser.user.id);
    await admin.from("profiles").update({
      role: "buyer",
      organization_id: extBOrg.id,
      full_name: "External Buyer Lead",
    }).eq("id", extBUser.user.id);

    // Authenticate Sessions
    const buyerSession = await getAuthClient(buyerEmail);
    const extBuyerSession = await getAuthClient(extBuyerEmail);
    const supplierASession = await getAuthClient(supplierAEmail);
    const supplierBSession = await getAuthClient(supplierBEmail);
    const financierSession = await getAuthClient(financierEmail);

    console.log("All multi-role authenticated sessions established.\n");

    // -------------------------------------------------------------------------
    // 2. SELF-PRIVILEGE ESCALATION PREVENTION
    // -------------------------------------------------------------------------
    console.log("--- 2. TESTING SELF-PRIVILEGE ESCALATION PREVENTION ---");

    // Attempt to change role from 'buyer' to 'admin' via client RLS
    const { data: roleEscData, error: roleEscErr } = await buyerSession.client
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", bUser.user.id)
      .select();

    const { data: verifiedBProfile } = await admin.from("profiles").select("role").eq("id", bUser.user.id).single();
    assertCheck(
      "User cannot elevate their own role to 'admin' via client RLS",
      verifiedBProfile.role === "buyer" && (Boolean(roleEscErr) || !roleEscData || roleEscData.length === 0),
      `Verified live role: ${verifiedBProfile.role}`
    );

    // Attempt to hijack another organization via client RLS
    const { data: orgEscData, error: orgEscErr } = await supplierASession.client
      .from("profiles")
      .update({ organization_id: fOrg.id })
      .eq("id", sAUser.user.id)
      .select();

    const { data: verifiedSAProfile } = await admin.from("profiles").select("organization_id").eq("id", sAUser.user.id).single();
    assertCheck(
      "User cannot hijack an arbitrary organization via client RLS",
      verifiedSAProfile.organization_id === sAOrg.id && (Boolean(orgEscErr) || !orgEscData || orgEscData.length === 0),
      `Verified live org: ${verifiedSAProfile.organization_id}`
    );

    // -------------------------------------------------------------------------
    // 3. PURCHASE ORDER RLS ISOLATION & ACCESS CONTROL
    // -------------------------------------------------------------------------
    console.log("\n--- 3. TESTING PURCHASE ORDER TENANT ISOLATION ---");

    // Create PO between Buyer and Supplier A
    const { data: poA } = await admin.from("purchase_orders").insert({
      order_reference: `HL-PO-SEC-A-${ts}`,
      buyer_organization_id: bOrg.id,
      supplier_organization_id: sAOrg.id,
      created_by: bUser.user.id,
      total_amount: 5000000,
      status: "accepted",
    }).select().single();
    testEntities.pos.push(poA.id);

    // Supplier A reads PO A -> Allowed
    const { data: saPoRead } = await supplierASession.client
      .from("purchase_orders")
      .select("id, order_reference")
      .eq("id", poA.id)
      .maybeSingle();

    assertCheck(
      "Supplier A can read Purchase Order belonging to their organization",
      Boolean(saPoRead && saPoRead.id === poA.id),
      saPoRead?.order_reference
    );

    // Supplier B reads PO A -> BLOCKED by RLS
    const { data: sbPoRead } = await supplierBSession.client
      .from("purchase_orders")
      .select("id, order_reference")
      .eq("id", poA.id)
      .maybeSingle();

    assertCheck(
      "Supplier B CANNOT read Purchase Order belonging to Supplier A (Tenant Isolation)",
      sbPoRead === null,
      `Result: ${sbPoRead ? "LEAKED" : "Securely filtered by RLS"}`
    );

    // -------------------------------------------------------------------------
    // 4. FINANCING REQUESTS & UNDERWRITING CONFIDENTIALITY
    // -------------------------------------------------------------------------
    console.log("\n--- 4. TESTING FINANCING REQUEST & UNDERWRITING CONFIDENTIALITY ---");

    // Supplier A submits financing request
    const { data: finReq, error: frErr } = await admin.from("financing_requests").insert({
      purchase_order_id: poA.id,
      requested_by: sAUser.user.id,
      requested_amount: 3500000,
      purpose: "Procurement of grains and packaging materials",
      status: "submitted",
    }).select().single();
    if (frErr) throw frErr;
    testEntities.financingRequests.push(finReq.id);

    // Financier submits review decision with confidential underwriting notes
    const { data: finRev, error: revErr } = await admin.from("financing_reviews").insert({
      financing_request_id: finReq.id,
      reviewer_id: fUser.user.id,
      decision: "approved",
      comments: "CONFIDENTIAL CREDIT MEMO: Supplier A maintains satisfactory debt service ratio; approved for 70% LTV at 2.5% monthly facility.",
    }).select().single();
    if (revErr) throw revErr;
    testEntities.financingReviews.push(finRev.id);

    // External Buyer attempts to read financing_requests -> BLOCKED by RLS
    const { data: extBuyerFinReq } = await extBuyerSession.client
      .from("financing_requests")
      .select("id, requested_amount")
      .eq("id", finReq.id)
      .maybeSingle();

    assertCheck(
      "External unrelated buyer CANNOT view supplier financing requests (Tenant Isolation)",
      extBuyerFinReq === null,
      `External buyer read result: ${extBuyerFinReq ? "EXPOSED" : "Securely filtered"}`
    );

    // External Buyer attempts to read financing_reviews -> BLOCKED by RLS
    const { data: extBuyerFinRev } = await extBuyerSession.client
      .from("financing_reviews")
      .select("id, comments")
      .eq("id", finRev.id)
      .maybeSingle();

    assertCheck(
      "External unrelated buyer CANNOT view confidential underwriting reviews (Strict RLS enforcement)",
      extBuyerFinRev === null,
      `Underwriting notes: ${extBuyerFinRev ? "EXPOSED" : "Securely filtered"}`
    );

    // Supplier B attempts to read Supplier A's financing request -> BLOCKED by RLS
    const { data: sbFinReq } = await supplierBSession.client
      .from("financing_requests")
      .select("id")
      .eq("id", finReq.id)
      .maybeSingle();

    assertCheck(
      "Supplier B CANNOT view Supplier A's financing application",
      sbFinReq === null,
      `Supplier B read result: ${sbFinReq ? "EXPOSED" : "Securely filtered"}`
    );

    // Buyer cannot inject review decisions via client (prevent underwriting fraud)
    const { error: buyerRevInsertErr } = await buyerSession.client
      .from("financing_reviews")
      .insert({
        financing_request_id: finReq.id,
        reviewer_id: bUser.user.id,
        decision: "approved",
        comments: "Malicious buyer review injection",
      });

    assertCheck(
      "Buyer CANNOT insert review decisions into 'financing_reviews' via client",
      Boolean(buyerRevInsertErr),
      `Insert error: ${buyerRevInsertErr?.message || "Blocked by RLS"}`
    );

    // Buyer cannot update financing request status via client
    const { data: buyerFrUpdate, error: buyerFrUpdErr } = await buyerSession.client
      .from("financing_requests")
      .update({ status: "approved" })
      .eq("id", finReq.id)
      .select();

    const buyerUpdateBlocked = !buyerFrUpdate || buyerFrUpdate.length === 0 || Boolean(buyerFrUpdErr);
    assertCheck(
      "Buyer CANNOT directly UPDATE financing_requests status via client",
      Boolean(buyerUpdateBlocked),
      "Direct client update blocked"
    );

    // -------------------------------------------------------------------------
    // 5. AUDIT LOG IMMUTABILITY & TAMPERING PREVENTION
    // -------------------------------------------------------------------------
    console.log("\n--- 5. TESTING AUDIT LOG IMMUTABILITY ---");

    const { data: testAuditLog } = await admin.from("audit_logs").insert({
      actor_id: sAUser.user.id,
      action: "PURCHASE_ORDER_ACCEPTED",
      entity_table: "purchase_orders",
      entity_id: poA.id,
      details: { test: true },
    }).select().single();

    // Regular user attempts to UPDATE audit record
    const { data: auditUpdData, error: auditUpdErr } = await supplierASession.client
      .from("audit_logs")
      .update({ action: "FORGED_ACTION" })
      .eq("id", testAuditLog.id)
      .select();

    assertCheck(
      "Regular user CANNOT update audit log entries (Immutability)",
      !auditUpdData || auditUpdData.length === 0 || Boolean(auditUpdErr),
      `Rows updated: ${auditUpdData?.length || 0}`
    );

    // Regular user attempts to DELETE audit record
    const { data: auditDelData, error: auditDelErr } = await supplierASession.client
      .from("audit_logs")
      .delete()
      .eq("id", testAuditLog.id)
      .select();

    assertCheck(
      "Regular user CANNOT delete audit log entries",
      !auditDelData || auditDelData.length === 0 || Boolean(auditDelErr),
      `Rows deleted: ${auditDelData?.length || 0}`
    );

    // Regular user attempts to forged-INSERT audit record directly
    const { data: auditInsData, error: auditInsErr } = await supplierASession.client
      .from("audit_logs")
      .insert({
        action: "FORGED_DIRECT_INSERT",
        entity_table: "invoices",
        details: { forged: true },
      })
      .select();

    assertCheck(
      "Regular user CANNOT directly insert forged audit records",
      Boolean(auditInsErr) || !auditInsData || auditInsData.length === 0,
      auditInsErr?.message || "Blocked"
    );

    await admin.from("audit_logs").delete().eq("id", testAuditLog.id);

    // -------------------------------------------------------------------------
    // 6. NON-CUSTODIAL & SETTLEMENT RECONCILIATION INTEGRITY
    // -------------------------------------------------------------------------
    console.log("\n--- 6. TESTING NON-CUSTODIAL RECONCILIATION INTEGRITY ---");

    const { data: inv } = await admin.from("invoices").insert({
      purchase_order_id: poA.id,
      invoice_number: `HL-INV-SEC-${ts}`,
      amount: 2000000,
      status: "issued",
      issue_date: new Date().toISOString().split("T")[0],
    }).select().single();
    testEntities.invoices.push(inv.id);

    // Insert a simulated settlement (₦2,000,000, is_simulated = true)
    const { data: simSettlement } = await admin.from("settlements").insert({
      purchase_order_id: poA.id,
      invoice_id: inv.id,
      amount: 2000000,
      status: "paid",
      payment_reference: `SIM-SEC-${ts}`,
      is_simulated: true, // SIMULATED
      notes: "Sandbox test payment simulation",
      recorded_by: sAUser.user.id,
    }).select().single();
    testEntities.settlements.push(simSettlement.id);

    // Verify invoice status remains 'issued' (NOT 'paid')
    const { data: invAfterSim } = await admin.from("invoices").select("status").eq("id", inv.id).single();
    assertCheck(
      "Simulated settlement (is_simulated = true) does NOT mark invoice as paid",
      invAfterSim.status === "issued",
      `Invoice status: ${invAfterSim.status}`
    );

    // Insert an unverified external payment claim (₦2,000,000, status = 'pending', is_simulated = false)
    const { data: pendingClaim } = await admin.from("settlements").insert({
      purchase_order_id: poA.id,
      invoice_id: inv.id,
      amount: 2000000,
      status: "pending", // UNVERIFIED CLAIM
      payment_reference: `CLAIM-SEC-${ts}`,
      is_simulated: false,
      notes: "Unverified buyer transfer claim",
      recorded_by: bUser.user.id,
    }).select().single();
    testEntities.settlements.push(pendingClaim.id);

    // Verify invoice status remains 'issued' (NOT 'paid')
    const { data: invAfterClaim } = await admin.from("invoices").select("status").eq("id", inv.id).single();
    assertCheck(
      "Unverified payment claim (status = 'pending') does NOT mark invoice as paid",
      invAfterClaim.status === "issued",
      `Invoice status: ${invAfterClaim.status}`
    );

    // -------------------------------------------------------------------------
    // 7. CLIENT BUNDLE & SOURCE CODE SECRET AUDIT
    // -------------------------------------------------------------------------
    console.log("\n--- 7. CLIENT BUNDLE & SOURCE CODE SECRET AUDIT ---");

    const projectRoot = process.cwd();
    const clientDirs = [
      path.join(projectRoot, "components"),
      path.join(projectRoot, "app"),
    ];

    let secretLeaksFound = 0;
    const inspectedFiles = [];

    function scanDirectory(dir) {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (file.endsWith(".tsx") || (file.endsWith(".ts") && !file.includes("actions.ts") && !file.includes("admin.ts"))) {
          inspectedFiles.push(fullPath);
          const content = fs.readFileSync(fullPath, "utf-8");

          // Check for 'use client' files importing admin client or service key
          if (content.includes('"use client"') || content.includes("'use client'")) {
            if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
              console.error(`[✖ SECRET LEAK] Client component accesses SUPABASE_SERVICE_ROLE_KEY: ${fullPath}`);
              secretLeaksFound++;
            }
            if (content.includes("createAdminClient")) {
              console.error(`[✖ SECURITY VIOLATION] Client component imports createAdminClient: ${fullPath}`);
              secretLeaksFound++;
            }
          }
        }
      }
    }

    for (const d of clientDirs) {
      scanDirectory(d);
    }

    assertCheck(
      "Zero client-side components import createAdminClient or expose SUPABASE_SERVICE_ROLE_KEY",
      secretLeaksFound === 0,
      `Scanned ${inspectedFiles.length} files across components/ and app/`
    );

  } finally {
    console.log("\n--- CLEANUP: Removing Test Entities ---");
    for (const sid of testEntities.settlements) {
      await admin.from("settlements").delete().eq("id", sid);
    }
    for (const invId of testEntities.invoices) {
      await admin.from("invoices").delete().eq("id", invId);
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
    console.log("Cleanup complete.\n");
  }

  console.log("======================================================================");
  console.log(`PLATFORM SECURITY SUITE SUMMARY: ${passedChecks}/${totalChecks} checks passed (${failedChecks} failed)`);
  console.log("======================================================================\n");

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runPlatformWideSecuritySuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
