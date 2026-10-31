import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function testAuditImmutability() {
  console.log("=== TESTING AUDIT LOG IMMUTABILITY ===");
  const ts = Date.now();

  // Create test user
  const { data: u } = await admin.auth.admin.createUser({
    email: `audit_tester_${ts}@hl.test`,
    password: "Password123!",
    email_confirm: true,
  });

  // Create an audit log record
  const { data: logEntry } = await admin.from("audit_logs").insert({
    actor_id: u.user.id,
    action: "TEST_AUDIT_ACTION",
    entity_table: "purchase_orders",
    details: { test: true },
  }).select().single();

  console.log("Created test audit log ID:", logEntry.id);

  // Authenticate as non-admin user
  const clientUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  await clientUser.auth.signInWithPassword({
    email: `audit_tester_${ts}@hl.test`,
    password: "Password123!",
  });

  // 1. Attempt UPDATE
  const { data: updData, error: updErr } = await clientUser
    .from("audit_logs")
    .update({ action: "FORGED_ACTION" })
    .eq("id", logEntry.id)
    .select();

  console.log("Audit log UPDATE attempt by regular user:", {
    rowsAffected: updData?.length,
    error: updErr?.message,
    blocked: !updData || updData.length === 0 || Boolean(updErr)
  });

  // 2. Attempt DELETE
  const { data: delData, error: delErr } = await clientUser
    .from("audit_logs")
    .delete()
    .eq("id", logEntry.id)
    .select();

  console.log("Audit log DELETE attempt by regular user:", {
    rowsAffected: delData?.length,
    error: delErr?.message,
    blocked: !delData || delData.length === 0 || Boolean(delErr)
  });

  // 3. Attempt direct forged INSERT
  const { data: insData, error: insErr } = await clientUser
    .from("audit_logs")
    .insert({
      action: "FORGED_CLIENT_ACTION",
      entity_table: "invoices",
      details: { forged: true },
    })
    .select();

  console.log("Audit log direct INSERT attempt by regular user:", {
    rowsAffected: insData?.length,
    error: insErr?.message,
    blocked: !insData || insData.length === 0 || Boolean(insErr)
  });

  // Cleanup
  await admin.from("audit_logs").delete().eq("id", logEntry.id);
  await admin.auth.admin.deleteUser(u.user.id);
  console.log("Cleanup done.");
}

testAuditImmutability().catch(console.error);
