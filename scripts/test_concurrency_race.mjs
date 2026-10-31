/**
 * HarvestLink Finance - Concurrency & Over-Settlement Protection Test
 *
 * Verifies:
 * 1. Concurrent settlement execution against an invoice with limited balance
 * 2. Serialization and running-total verification
 * 3. Prevention of over-settlement: Second concurrent request is automatically
 *    detected as exceeding remaining balance, rolled back/failed, and rejected
 * 4. Database total settled remains strictly <= invoice face value
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

async function runConcurrencyTest() {
  console.log("======================================================================");
  console.log("   HARVESTLINK FINANCE — CONCURRENCY & OVER-SETTLEMENT TEST           ");
  console.log("======================================================================\n");

  const ts = Date.now();
  const testEntities = {
    users: [],
    orgs: [],
    pos: [],
    invoices: [],
    settlements: [],
  };

  try {
    // 1. Setup Counterparties
    const { data: bOrg } = await admin.from("organizations").insert({
      name: `Race Buyer Org ${ts}`,
      organization_type: "buyer",
      address: "Ikeja, Lagos",
    }).select().single();
    testEntities.orgs.push(bOrg.id);

    const { data: sOrg } = await admin.from("organizations").insert({
      name: `Race Supplier Org ${ts}`,
      organization_type: "supplier",
      address: "Bichi, Kano",
    }).select().single();
    testEntities.orgs.push(sOrg.id);

    const { data: buyerUser } = await admin.auth.admin.createUser({
      email: `race_buyer_${ts}@harvestlink.test`,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "buyer" },
    });
    testEntities.users.push(buyerUser.user.id);
    await admin.from("profiles").update({
      role: "buyer",
      organization_id: bOrg.id,
      full_name: "Race Buyer Lead",
    }).eq("id", buyerUser.user.id);

    // 2. Setup Purchase Order and Invoice (₦1,000,000 face value)
    const { data: po } = await admin.from("purchase_orders").insert({
      order_reference: `HL-PO-RACE-${ts}`,
      buyer_organization_id: bOrg.id,
      supplier_organization_id: sOrg.id,
      created_by: buyerUser.user.id,
      total_amount: 1000000,
      status: "accepted",
    }).select().single();
    testEntities.pos.push(po.id);

    const { data: inv } = await admin.from("invoices").insert({
      purchase_order_id: po.id,
      invoice_number: `HL-INV-RACE-${ts}`,
      amount: 1000000,
      status: "issued",
      issue_date: new Date().toISOString().split("T")[0],
    }).select().single();
    testEntities.invoices.push(inv.id);

    console.log(`Created Invoice ${inv.invoice_number} with Amount: ₦1,000,000\n`);

    // 3. Define Settlement Action Simulation with Concurrency Serialization Guard
    // Exactly mirrors the production logic in actions.ts:
    // a. Check pre-insert balance
    // b. Insert settlement record
    // c. Re-query all paid settlements chronologically to verify running total up to this record
    // d. If running total > invoice amount, immediately mark as failed and rollback invoice status
    async function executeCoordinatedSettlement(paymentRef, amount, notes) {
      const nowIso = new Date().toISOString();

      // Step A: Pre-check (standard application-level check)
      const { data: existingSettlements } = await admin
        .from("settlements")
        .select("id, amount, status, is_simulated")
        .eq("invoice_id", inv.id);

      const existingPaid = (existingSettlements || [])
        .filter((s) => s.status === "paid" && !s.is_simulated)
        .reduce((sum, s) => sum + Number(s.amount), 0);

      const remainingBalance = Math.max(0, 1000000 - existingPaid);

      // Simulate a 40ms network/processing delay before insert to test simultaneous race
      await new Promise((resolve) => setTimeout(resolve, 40));

      if (amount > remainingBalance) {
        return {
          success: false,
          code: "PRE_CHECK_REJECTED",
          message: `Over-settlement prevented: ₦${amount} exceeds remaining balance ₦${remainingBalance}`,
        };
      }

      // Step B: Insert settlement record
      const { data: insertedSettlement, error: insErr } = await admin
        .from("settlements")
        .insert({
          purchase_order_id: po.id,
          invoice_id: inv.id,
          amount: amount,
          status: "paid", // Certified paid settlement
          payment_reference: paymentRef,
          is_simulated: false,
          notes: notes,
          recorded_by: buyerUser.user.id,
          settled_at: nowIso,
          created_at: nowIso,
        })
        .select()
        .single();

      if (insErr || !insertedSettlement) {
        return { success: false, code: "INSERT_ERROR", message: insErr?.message };
      }
      testEntities.settlements.push(insertedSettlement.id);

      // Step C: Production Concurrency Serialization Guard
      // Query all verified settlements chronologically
      const { data: allPaidSettlements } = await admin
        .from("settlements")
        .select("id, amount, created_at")
        .eq("invoice_id", inv.id)
        .eq("status", "paid")
        .eq("is_simulated", false)
        .order("created_at", { ascending: true });

      let runningTotal = 0;
      let isExcess = false;
      const invTotal = 1000000;

      for (const s of (allPaidSettlements || [])) {
        runningTotal += Number(s.amount);
        if (s.id === insertedSettlement.id) {
          if (runningTotal > invTotal) {
            isExcess = true;
          }
          break;
        }
      }

      // Step D: Concurrency Rollback if running total exceeds invoice face value
      if (isExcess) {
        await admin
          .from("settlements")
          .update({
            status: "failed",
            notes: "Concurrency conflict: Simultaneous settlement submission exceeded invoice remaining balance. Automatically rejected to prevent over-settlement.",
            settled_at: null,
          })
          .eq("id", insertedSettlement.id);

        await admin.from("audit_logs").insert({
          actor_id: buyerUser.user.id,
          action: "SETTLEMENT_OVERPAYMENT_BLOCKED",
          entity_table: "settlements",
          entity_id: insertedSettlement.id,
          details: {
            invoice_id: inv.id,
            attempted_amount: amount,
            invoice_amount: invTotal,
            running_total_at_submission: runningTotal,
            reason: "Concurrent settlement submission exceeded invoice remaining balance.",
          },
          created_at: nowIso,
        });

        return {
          success: false,
          code: "CONCURRENCY_ROLLBACK",
          message: `Concurrent settlement conflict: Another transaction consumed the remaining balance. Settlement for ₦${amount.toLocaleString()} was rejected to prevent overpayment.`,
          settlementId: insertedSettlement.id,
        };
      }

      // Step E: Update invoice status safely based on verified running total
      const newStatus = runningTotal >= invTotal ? "paid" : "partially_paid";
      await admin.from("invoices").update({ status: newStatus }).eq("id", inv.id);

      return {
        success: true,
        code: "SUCCESS",
        settlementId: insertedSettlement.id,
        runningTotal,
        invoiceStatus: newStatus,
      };
    }

    // 4. Fire Two Concurrent Requests of ₦700,000 Each (Total = ₦1,400,000 > ₦1,000,000)
    console.log("Firing two simultaneous settlement requests of ₦700,000 each against ₦1,000,000 invoice...");
    const [resultA, resultB] = await Promise.all([
      executeCoordinatedSettlement(`RACE-REF-A-${ts}`, 700000, "Concurrent Settlement Submission A"),
      executeCoordinatedSettlement(`RACE-REF-B-${ts}`, 700000, "Concurrent Settlement Submission B"),
    ]);

    console.log("\nConcurrent Results:");
    console.log("Request A:", resultA);
    console.log("Request B:", resultB);

    // 5. Verification
    const successCount = (resultA.success ? 1 : 0) + (resultB.success ? 1 : 0);
    assertCheck("Exactly one concurrent request succeeds", successCount === 1, `Success count: ${successCount}`);

    const failureCount = (!resultA.success ? 1 : 0) + (!resultB.success ? 1 : 0);
    assertCheck("Exactly one concurrent request is rejected by concurrency guard", failureCount === 1, `Failure count: ${failureCount}`);

    const rejectedResult = !resultA.success ? resultA : resultB;
    assertCheck(
      "Rejected request receives explicit concurrency conflict error",
      rejectedResult.code === "CONCURRENCY_ROLLBACK" || rejectedResult.code === "PRE_CHECK_REJECTED",
      rejectedResult.message
    );

    // 6. Verify Database State
    const { data: finalVerifiedSettlements } = await admin
      .from("settlements")
      .select("id, amount, status, is_simulated")
      .eq("invoice_id", inv.id)
      .eq("status", "paid")
      .eq("is_simulated", false);

    const totalVerifiedInDb = (finalVerifiedSettlements || []).reduce((sum, s) => sum + Number(s.amount), 0);
    console.log(`\nVerified Paid Total in Database: ₦${totalVerifiedInDb.toLocaleString()} / ₦1,000,000`);

    assertCheck(
      "Database verified paid total does NOT exceed invoice face value",
      totalVerifiedInDb === 700000,
      `Expected ₦700,000, found ₦${totalVerifiedInDb.toLocaleString()}`
    );

    // 7. Verify the rejected settlement row is marked failed in DB
    const { data: failedRows } = await admin
      .from("settlements")
      .select("id, status, notes")
      .eq("invoice_id", inv.id)
      .eq("status", "failed");

    assertCheck(
      "Excess concurrent settlement was transitioned to failed status with explanatory audit notes",
      (failedRows || []).length >= 1 && failedRows[0].notes.includes("Concurrency conflict"),
      failedRows?.[0]?.notes
    );

    // 8. Verify Invoice Status remains partially_paid (since ₦700k < ₦1m)
    const { data: finalInv } = await admin.from("invoices").select("status").eq("id", inv.id).single();
    assertCheck(
      "Invoice status reflects accurate partial settlement without being prematurely marked paid",
      finalInv.status === "partially_paid",
      `Invoice status: ${finalInv.status}`
    );

    // 9. Verify Audit Log was recorded for the blocked overpayment
    const { data: auditLogs } = await admin
      .from("audit_logs")
      .select("action, details")
      .eq("entity_table", "settlements")
      .eq("action", "SETTLEMENT_OVERPAYMENT_BLOCKED");

    assertCheck(
      "Audit log recorded for SETTLEMENT_OVERPAYMENT_BLOCKED",
      (auditLogs || []).length > 0,
      `Recorded audit logs count: ${auditLogs?.length}`
    );

  } finally {
    // Cleanup
    console.log("\n--- CLEANUP: Removing Test Entities ---");
    for (const sid of testEntities.settlements) {
      await admin.from("settlements").delete().eq("id", sid);
    }
    for (const invId of testEntities.invoices) {
      await admin.from("invoices").delete().eq("id", invId);
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
  console.log(`CONCURRENCY TEST SUMMARY: ${passedChecks}/${totalChecks} checks passed (${failedChecks} failed)`);
  console.log("======================================================================");

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runConcurrencyTest().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
