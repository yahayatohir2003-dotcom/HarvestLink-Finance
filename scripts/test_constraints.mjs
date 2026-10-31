import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function discoverExactConstraints() {
  const ts = Date.now();
  const { data: bOrg } = await admin
    .from("organizations")
    .insert({ name: "Buyer " + ts, organization_type: "buyer" })
    .select()
    .single();
  const { data: sOrg } = await admin
    .from("organizations")
    .insert({ name: "Supplier " + ts, organization_type: "supplier" })
    .select()
    .single();
  const { data: u } = await admin.auth.admin.createUser({
    email: "disc_" + ts + "@hl.test",
    password: "Password123!",
    email_confirm: true,
    user_metadata: { role: "supplier" },
  });
  await admin
    .from("profiles")
    .update({ role: "supplier", organization_id: sOrg.id })
    .eq("id", u.user.id);
  const { data: po } = await admin
    .from("purchase_orders")
    .insert({
      order_reference: "HL-PO-DISC-" + ts,
      buyer_organization_id: bOrg.id,
      supplier_organization_id: sOrg.id,
      created_by: u.user.id,
      status: "submitted",
      total_amount: 1000,
    })
    .select()
    .single();

  console.log("--- TESTING CANDIDATE STATUSES FOR financing_requests.status ---");
  const candidateStatuses = [
    "draft",
    "submitted",
    "under_review",
    "approved",
    "declined",
    "denied",
    "reject",
    "rejected",
    "disapproved",
    "settled",
    "disbursed",
    "repaid",
    "closed",
    "cancelled",
    "withdrawn",
  ];
  for (const st of candidateStatuses) {
    const { data, error } = await admin
      .from("financing_requests")
      .insert({
        purchase_order_id: po.id,
        requested_by: u.user.id,
        requested_amount: 500,
        purpose: "Harvest capital",
        status: st,
      })
      .select();
    if (!error) {
      console.log(`financing_requests.status -> '${st}' is VALID!`);
      await admin.from("financing_requests").delete().eq("id", data[0].id);
    }
  }

  // Create one valid request
  const { data: validFr } = await admin
    .from("financing_requests")
    .insert({
      purchase_order_id: po.id,
      requested_by: u.user.id,
      requested_amount: 500,
      purpose: "Harvest capital",
      status: "submitted",
    })
    .select()
    .single();

  console.log("\n--- TESTING CANDIDATE DECISIONS FOR financing_reviews.decision ---");
  const candidateDecisions = [
    "approved",
    "declined",
    "denied",
    "rejected",
    "reject",
    "disapproved",
    "needs_revision",
    "request_changes",
    "more_info",
    "requires_action",
    "under_review",
    "recommended",
  ];
  for (const dec of candidateDecisions) {
    const { data, error } = await admin
      .from("financing_reviews")
      .insert({
        financing_request_id: validFr.id,
        reviewer_id: u.user.id,
        decision: dec,
        comments: "Test comments",
      })
      .select();
    if (!error) {
      console.log(`financing_reviews.decision -> '${dec}' is VALID!`);
      await admin.from("financing_reviews").delete().eq("id", data[0].id);
    }
  }

  // Cleanup
  await admin.from("financing_requests").delete().eq("id", validFr.id);
  await admin.from("purchase_orders").delete().eq("id", po.id);
  await admin.from("organizations").delete().in("id", [bOrg.id, sOrg.id]);
  await admin.auth.admin.deleteUser(u.user.id);
  await admin.from("profiles").delete().eq("id", u.user.id);
  console.log("\nCleanup finished.");
}

discoverExactConstraints().catch(console.error);
