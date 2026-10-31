import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function inspectSettlements() {
  console.log("=== INSPECTING SETTLEMENTS & INVOICES SCHEMA ===");

  // 1. Column metadata & sample record
  const { data: cols, error: colErr } = await admin
    .from("settlements")
    .select("*")
    .limit(1);

  console.log("Settlements query test:", { cols, colErr });

  // 2. Discover settlements_status_check candidate values
  console.log("\n--- Testing candidate statuses for settlements.status ---");
  const testCandidateStatuses = [
    "pending", "processing", "completed", "paid", "partial", "partially_paid",
    "failed", "cancelled", "rejected", "declined", "unverified", "verified", "disputed"
  ];

  // We need a dummy PO and dummy invoice to test inserts
  const ts = Date.now();
  const { data: bOrg } = await admin.from("organizations").insert({ name: "Buyer Insp " + ts, organization_type: "buyer" }).select().single();
  const { data: sOrg } = await admin.from("organizations").insert({ name: "Supplier Insp " + ts, organization_type: "supplier" }).select().single();
  const { data: u } = await admin.auth.admin.createUser({ email: "insp_" + ts + "@hl.test", password: "Password123!", email_confirm: true });
  await admin.from("profiles").upsert({ id: u.user.id, role: "supplier", organization_id: sOrg.id, full_name: "Inspector" });

  const { data: po } = await admin.from("purchase_orders").insert({
    order_reference: "HL-PO-INSP-" + ts,
    buyer_organization_id: bOrg.id,
    supplier_organization_id: sOrg.id,
    created_by: u.user.id,
    total_amount: 1000000,
    status: "accepted"
  }).select().single();

  const { data: inv } = await admin.from("invoices").insert({
    purchase_order_id: po.id,
    invoice_number: "HL-INV-INSP-" + ts,
    amount: 1000000,
    status: "issued"
  }).select().single();

  const validSettlementStatuses = [];
  for (const st of testCandidateStatuses) {
    const { data, error } = await admin.from("settlements").insert({
      purchase_order_id: po.id,
      invoice_id: inv.id,
      amount: 1000,
      status: st,
      is_simulated: true
    }).select();
    if (!error) {
      validSettlementStatuses.push(st);
      await admin.from("settlements").delete().eq("id", data[0].id);
    }
  }
  console.log("Valid settlements.status values:", validSettlementStatuses);

  // 3. Test check constraints on amount
  console.log("\n--- Testing constraints on settlements.amount ---");
  const { error: zeroAmtErr } = await admin.from("settlements").insert({
    purchase_order_id: po.id,
    invoice_id: inv.id,
    amount: 0,
    status: "paid"
  });
  console.log("Settlement amount = 0 error:", zeroAmtErr ? zeroAmtErr.message : "ALLOWED (no check constraint on amount <= 0!)");

  const { error: negAmtErr } = await admin.from("settlements").insert({
    purchase_order_id: po.id,
    invoice_id: inv.id,
    amount: -100,
    status: "paid"
  });
  console.log("Settlement amount < 0 error:", negAmtErr ? negAmtErr.message : "ALLOWED (no check constraint on amount < 0!)");

  // 4. Test payment_reference uniqueness
  console.log("\n--- Testing payment_reference uniqueness ---");
  const refCode = "REF-" + ts;
  const { data: set1, error: set1Err } = await admin.from("settlements").insert({
    purchase_order_id: po.id,
    invoice_id: inv.id,
    amount: 500,
    status: "pending",
    payment_reference: refCode
  }).select().single();

  const { data: set2, error: set2Err } = await admin.from("settlements").insert({
    purchase_order_id: po.id,
    invoice_id: inv.id,
    amount: 500,
    status: "pending",
    payment_reference: refCode
  }).select();
  console.log("Duplicate payment_reference error:", set2Err ? set2Err.message : "ALLOWED (duplicate references permitted at DB level!)");

  if (set1) await admin.from("settlements").delete().eq("id", set1.id);
  if (set2 && set2[0]) await admin.from("settlements").delete().eq("id", set2[0].id);

  // 5. Check RLS policies on settlements
  console.log("\n--- Testing RLS on settlements for different roles ---");

  // Create buyer user
  const { data: bUser } = await admin.auth.admin.createUser({ email: "binsp_" + ts + "@hl.test", password: "Password123!", email_confirm: true });
  await admin.from("profiles").upsert({ id: bUser.user.id, role: "buyer", organization_id: bOrg.id, full_name: "Buyer Inspector" });

  // Create financier user
  const { data: fUser } = await admin.auth.admin.createUser({ email: "finsp_" + ts + "@hl.test", password: "Password123!", email_confirm: true });
  await admin.from("profiles").upsert({ id: fUser.user.id, role: "financier", full_name: "Financier Inspector" });

  // Insert a test settlement via admin
  const { data: testSettlement } = await admin.from("settlements").insert({
    purchase_order_id: po.id,
    invoice_id: inv.id,
    amount: 500000,
    status: "paid",
    payment_reference: "TEST-SETTLE-RLS",
    is_simulated: true,
    recorded_by: u.user.id
  }).select().single();

  // Test Supplier A read
  const supClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await supClient.auth.signInWithPassword({ email: "insp_" + ts + "@hl.test", password: "Password123!" });
  const { data: supRead, error: supErr } = await supClient.from("settlements").select("*").eq("id", testSettlement.id);
  console.log("Supplier read settlements:", { rows: supRead?.length, error: supErr?.message });

  // Test Supplier A direct insert
  const { data: supIns, error: supInsErr } = await supClient.from("settlements").insert({
    purchase_order_id: po.id,
    invoice_id: inv.id,
    amount: 100,
    status: "pending"
  }).select();
  console.log("Supplier direct insert settlements:", { allowed: Boolean(supIns), error: supInsErr?.message });

  // Test Buyer read
  const buyerClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await buyerClient.auth.signInWithPassword({ email: "binsp_" + ts + "@hl.test", password: "Password123!" });
  const { data: buyerRead, error: buyerErr } = await buyerClient.from("settlements").select("*").eq("id", testSettlement.id);
  console.log("Buyer read settlements:", { rows: buyerRead?.length, error: buyerErr?.message });

  // Test Financier read
  const finClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await finClient.auth.signInWithPassword({ email: "finsp_" + ts + "@hl.test", password: "Password123!" });
  const { data: finRead, error: finErr } = await finClient.from("settlements").select("*").eq("id", testSettlement.id);
  console.log("Financier read settlements:", { rows: finRead?.length, error: finErr?.message });

  // Cleanup
  await admin.from("settlements").delete().eq("id", testSettlement.id);
  await admin.from("invoices").delete().eq("id", inv.id);
  await admin.from("purchase_orders").delete().eq("id", po.id);
  await admin.from("organizations").delete().in("id", [bOrg.id, sOrg.id]);
  await admin.from("profiles").delete().in("id", [u.user.id, bUser.user.id, fUser.user.id]);
  await admin.auth.admin.deleteUser(u.user.id);
  await admin.auth.admin.deleteUser(bUser.user.id);
  await admin.auth.admin.deleteUser(fUser.user.id);

  console.log("\nInspection complete & test entities cleaned up.");
}

inspectSettlements().catch(console.error);
