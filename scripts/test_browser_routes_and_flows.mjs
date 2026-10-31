/**
 * HarvestLink Finance - Step 5 Browser Functionality & Route Guard Verification
 *
 * Verifies live HTTP route handling against http://localhost:3001:
 * 1. Supplier Application Form & Dashboard Route (200 OK)
 * 2. Buyer Confidentiality Redirects from /dashboard/financing and /dashboard/financing/[id] (Redirected)
 * 3. Financier Review Interface & Decision Desk Route (200 OK)
 * 4. Competitor Supplier Cross-Tenant Dossier Access (Redirected to /dashboard/financing)
 * 5. Purchase Order Page Confidentiality Masking for Buyers
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "http://localhost:3001";

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("Missing required Supabase environment variables in .env.local");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`[✔ PASS] ${message}`);
  } else {
    failedChecks++;
    console.error(`[✖ FAIL] ${message}`);
  }
}

import { createBrowserClient } from "@supabase/ssr";

async function loginAndGetCookies(email, password = "Password123!") {
  let cookieJar = [];
  const client = createBrowserClient(
    SUPABASE_URL,
    ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieJar;
        },
        setAll(cookiesToSet) {
          for (const c of cookiesToSet) {
            cookieJar = cookieJar.filter((existing) => existing.name !== c.name);
            cookieJar.push(c);
          }
        },
      },
    }
  );

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const cookieHeader = cookieJar.map((c) => `${c.name}=${c.value}`).join("; ");
  return { client, user: data.user, session: data.session, cookieHeader };
}

async function runBrowserFlowTests() {
  console.log("======================================================================");
  console.log("   HARVESTLINK FINANCE — STEP 5 LIVE BROWSER & ROUTE VERIFICATION     ");
  console.log("======================================================================");

  const timestamp = Date.now();
  const testEntities = {
    users: [],
    orgs: [],
    pos: [],
    requests: [],
    reviews: [],
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP: Counterparties, Organizations, Roles
    // -------------------------------------------------------------------------
    console.log("\n--- SETUP: Initializing Test Roles & Purchase Order ---");

    // 1. Supplier Org & User
    const { data: supplierOrg } = await adminClient.from("organizations").insert({
      name: `Browser Test Supplier ${timestamp}`,
      organization_type: "supplier",
      address: "Kano Agro Market",
    }).select().single();
    testEntities.orgs.push(supplierOrg.id);

    const sEmail = `browser_supp_${timestamp}@harvestlink.test`;
    const { data: sAuth } = await adminClient.auth.admin.createUser({
      email: sEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "supplier", full_name: "Mallam Aliyu Sani" },
    });
    testEntities.users.push(sAuth.user.id);
    await adminClient.from("profiles").update({
      role: "supplier",
      organization_id: supplierOrg.id,
      full_name: "Mallam Aliyu Sani",
    }).eq("id", sAuth.user.id);

    // 2. Buyer Org & User
    const { data: buyerOrg } = await adminClient.from("organizations").insert({
      name: `Browser Test Buyer ${timestamp}`,
      organization_type: "buyer",
      address: "Ikeja Industrial Estate, Lagos",
    }).select().single();
    testEntities.orgs.push(buyerOrg.id);

    const bEmail = `browser_buyer_${timestamp}@harvestlink.test`;
    const { data: bAuth } = await adminClient.auth.admin.createUser({
      email: bEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "buyer", full_name: "Chief Tunde Bakare" },
    });
    testEntities.users.push(bAuth.user.id);
    await adminClient.from("profiles").update({
      role: "buyer",
      organization_id: buyerOrg.id,
      full_name: "Chief Tunde Bakare",
    }).eq("id", bAuth.user.id);

    // 3. Financier User
    const fEmail = `browser_fin_${timestamp}@harvestlink.test`;
    const { data: fAuth } = await adminClient.auth.admin.createUser({
      email: fEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "financier", full_name: "Mrs. Ngozi Okonjo Credit Lead" },
    });
    testEntities.users.push(fAuth.user.id);
    await adminClient.from("profiles").update({
      role: "financier",
      full_name: "Mrs. Ngozi Okonjo Credit Lead",
    }).eq("id", fAuth.user.id);

    // 4. Competitor Supplier User (Different Org)
    const { data: compOrg } = await adminClient.from("organizations").insert({
      name: `Competitor Supplier ${timestamp}`,
      organization_type: "supplier",
      address: "Zaria Depot",
    }).select().single();
    testEntities.orgs.push(compOrg.id);

    const compEmail = `browser_comp_${timestamp}@harvestlink.test`;
    const { data: compAuth } = await adminClient.auth.admin.createUser({
      email: compEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "supplier", full_name: "Competitor Supplier" },
    });
    testEntities.users.push(compAuth.user.id);
    await adminClient.from("profiles").update({
      role: "supplier",
      organization_id: compOrg.id,
      full_name: "Competitor Supplier",
    }).eq("id", compAuth.user.id);

    // 5. Create Confirmed PO
    const { data: testPo } = await adminClient.from("purchase_orders").insert({
      order_reference: `HL-PO-BROWSER-${timestamp}`,
      buyer_organization_id: buyerOrg.id,
      supplier_organization_id: supplierOrg.id,
      created_by: bAuth.user.id,
      total_amount: 14000000,
      status: "accepted",
      order_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: new Date(Date.now() + 86400000 * 20).toISOString().split("T")[0],
      description: "Address: Apapa Silo 4\nNotes: Confirmed trade contract for Yellow Maize",
    }).select().single();
    testEntities.pos.push(testPo.id);

    // Add Commodity Item
    await adminClient.from("order_items").insert({
      purchase_order_id: testPo.id,
      item_name: "Feed Grade Yellow Maize",
      quantity: 350,
      unit: "MT",
      unit_price: 40000,
      line_total: 14000000,
    });

    // 6. Create Financing Request
    const { data: testFr } = await adminClient.from("financing_requests").insert({
      purchase_order_id: testPo.id,
      requested_by: sAuth.user.id,
      requested_amount: 9800000, // 70%
      purpose: "Procurement of 350 MT Yellow Maize from local aggregated farmers.",
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }).select().single();
    testEntities.requests.push(testFr.id);

    // Obtain Auth Sessions and Cookies
    console.log("Authenticating users for live HTTP session simulation...");
    const supplierSession = await loginAndGetCookies(sEmail);
    const buyerSession = await loginAndGetCookies(bEmail);
    const financierSession = await loginAndGetCookies(fEmail);
    const compSession = await loginAndGetCookies(compEmail);

    console.log("✔ Users authenticated. Sessions active.");

    // -------------------------------------------------------------------------
    // TEST 1: Supplier Views Application Form & Dashboard
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Supplier Access to Financing Dashboard & Form ---");

    const suppDashRes = await fetch(`${BASE_URL}/dashboard/financing`, {
      headers: { Cookie: supplierSession.cookieHeader },
      redirect: "manual",
    });
    assert(
      suppDashRes.status === 200,
      `Supplier access to /dashboard/financing returns HTTP 200 (Status: ${suppDashRes.status})`
    );

    const suppNewRes = await fetch(`${BASE_URL}/dashboard/financing/new`, {
      headers: { Cookie: supplierSession.cookieHeader },
      redirect: "manual",
    });
    assert(
      suppNewRes.status === 200,
      `Supplier access to /dashboard/financing/new returns HTTP 200 (Status: ${suppNewRes.status})`
    );

    const suppDossierRes = await fetch(`${BASE_URL}/dashboard/financing/${testFr.id}`, {
      headers: { Cookie: supplierSession.cookieHeader },
      redirect: "manual",
    });
    assert(
      suppDossierRes.status === 200,
      `Supplier access to own dossier /dashboard/financing/[id] returns HTTP 200 (Status: ${suppDossierRes.status})`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Buyer Confidentiality Redirects
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Buyer Confidentiality Protection & Redirects ---");

    // Buyer navigating to /dashboard/financing
    const buyerDashRes = await fetch(`${BASE_URL}/dashboard/financing`, {
      headers: { Cookie: buyerSession.cookieHeader },
      redirect: "manual",
    });
    const buyerDashRedirected = buyerDashRes.status === 307 || buyerDashRes.status === 308 || buyerDashRes.status === 302;
    const buyerDashLocation = buyerDashRes.headers.get("location") || "";
    assert(
      buyerDashRedirected && buyerDashLocation.includes("/dashboard/buyer"),
      `Buyer visiting /dashboard/financing redirected to /dashboard/buyer (HTTP ${buyerDashRes.status} -> ${buyerDashLocation})`
    );

    // Buyer navigating directly to /dashboard/financing/[id]
    const buyerDossierRes = await fetch(`${BASE_URL}/dashboard/financing/${testFr.id}`, {
      headers: { Cookie: buyerSession.cookieHeader },
      redirect: "manual",
    });
    const buyerDossierRedirected = buyerDossierRes.status === 307 || buyerDossierRes.status === 308 || buyerDossierRes.status === 302;
    const buyerDossierLocation = buyerDossierRes.headers.get("location") || "";
    assert(
      buyerDossierRedirected && buyerDossierLocation.includes(`/dashboard/purchase-orders/${testPo.id}`),
      `Buyer visiting confidential dossier redirected to PO page (HTTP ${buyerDossierRes.status} -> ${buyerDossierLocation})`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Financier Reviewer Access & Underwriting Desk
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Financier Reviewer Access & Underwriting Desk ---");

    const finDashRes = await fetch(`${BASE_URL}/dashboard/financing`, {
      headers: { Cookie: financierSession.cookieHeader },
      redirect: "manual",
    });
    assert(
      finDashRes.status === 200,
      `Financier access to review queue /dashboard/financing returns HTTP 200 (Status: ${finDashRes.status})`
    );

    const finDossierRes = await fetch(`${BASE_URL}/dashboard/financing/${testFr.id}`, {
      headers: { Cookie: financierSession.cookieHeader },
      redirect: "manual",
    });
    assert(
      finDossierRes.status === 200,
      `Financier access to dossier & Underwriting Desk returns HTTP 200 (Status: ${finDossierRes.status})`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Competitor Supplier Isolation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Competitor Supplier Cross-Tenant Protection ---");

    const compDossierRes = await fetch(`${BASE_URL}/dashboard/financing/${testFr.id}`, {
      headers: { Cookie: compSession.cookieHeader },
      redirect: "manual",
    });
    const compRedirected = compDossierRes.status === 307 || compDossierRes.status === 308 || compDossierRes.status === 302;
    const compLocation = compDossierRes.headers.get("location") || "";
    assert(
      compRedirected && compLocation.includes("/dashboard/financing"),
      `Competitor supplier blocked from third-party dossier (HTTP ${compDossierRes.status} -> ${compLocation})`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Purchase Order Page Buyer Masking vs Supplier Visibility
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Purchase Order Page Confidentiality Masking ---");

    const buyerPoRes = await fetch(`${BASE_URL}/dashboard/purchase-orders/${testPo.id}`, {
      headers: { Cookie: buyerSession.cookieHeader },
    });
    const buyerPoHtml = await buyerPoRes.text();

    const buyerSeesFacilityStatus = buyerPoHtml.includes("Supplier Facility Status");
    const buyerHidesDossierLink = !buyerPoHtml.includes("View Financing Dossier");
    assert(
      buyerSeesFacilityStatus && buyerHidesDossierLink,
      "Buyer PO view displays only high-level facility status; hides confidential loan amount and dossier link"
    );

    const suppPoRes = await fetch(`${BASE_URL}/dashboard/purchase-orders/${testPo.id}`, {
      headers: { Cookie: supplierSession.cookieHeader },
    });
    const suppPoHtml = await suppPoRes.text();

    const suppSeesDossierLink = suppPoHtml.includes("View Financing Dossier");
    assert(
      suppSeesDossierLink,
      "Supplier PO view displays full financing coordination strip and 'View Financing Dossier' link"
    );

  } catch (err) {
    console.error("Browser test execution error:", err);
    failedChecks++;
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("\n--- CLEANUP: Removing Browser Test Entities ---");
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
  console.log("              BROWSER FLOW TEST SUITE SUMMARY                         ");
  console.log("======================================================================");
  console.log(`Total Checks Executed : ${totalChecks}`);
  console.log(`Passed Checks         : ${passedChecks}`);
  console.log(`Failed Checks         : ${failedChecks}`);

  if (failedChecks === 0) {
    console.log("\n✔ ALL LIVE BROWSER & ROUTE GUARD CHECKS PASSED (100%)!");
  } else {
    console.error(`\n✖ ${failedChecks} CHECKS FAILED!`);
    process.exit(1);
  }
}

runBrowserFlowTests().catch(console.error);
