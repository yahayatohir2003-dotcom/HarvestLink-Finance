/**
 * HarvestLink Finance - Live Browser Workflow & Route Authentication Verification
 *
 * Connects to live running server at http://localhost:3000 with real HTTP cookies:
 * 1. Supplier Role Workflow (Supplier Dashboard, POs, Invoices, Financing New)
 * 2. Buyer Role Workflow (Buyer Dashboard, PO New, Route Protection against Admin)
 * 3. Financier Role Workflow (Financier Decision Desk, Financing Queue)
 * 4. Platform Admin Workflow (Admin Dashboard, System Oversight)
 * 5. Unauthenticated User Guard (Redirects to /login)
 */

import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "http://localhost:3000";

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

function assertCheck(roleName, description, passed, detail = "") {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`[✔ PASS] [${roleName}] ${description}${detail ? ` - ${detail}` : ""}`);
  } else {
    failedChecks++;
    console.error(`[✖ FAIL] [${roleName}] ${description}${detail ? ` - ${detail}` : ""}`);
  }
}

async function loginAndGetCookies(email, password = "Password123!") {
  let cookieJar = [];
  const client = createBrowserClient(SUPABASE_URL, ANON_KEY, {
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
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const cookieHeader = cookieJar.map((c) => `${c.name}=${c.value}`).join("; ");
  return { client, user: data.user, cookieHeader };
}

async function fetchRoute(routePath, cookieHeader = "") {
  const headers = {};
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const res = await fetch(`${BASE_URL}${routePath}`, {
    headers,
    redirect: "manual",
  });
  const location = res.headers.get("location");
  const text = res.status === 200 ? await res.text() : "";
  return { status: res.status, location, text };
}

async function runLiveBrowserWorkflowVerification() {
  console.log("======================================================================");
  console.log("   HARVESTLINK FINANCE — LIVE BROWSER WORKFLOW & ROUTE VERIFICATION   ");
  console.log("======================================================================\n");

  const ts = Date.now();
  const testEntities = { users: [], orgs: [], pos: [], invoices: [] };

  try {
    // -------------------------------------------------------------------------
    // 1. SETUP: Create 4 Authenticated Accounts
    // -------------------------------------------------------------------------
    console.log("--- SETUP: Creating Live Multi-Role Accounts ---");

    // Supplier
    const { data: sOrg } = await admin.from("organizations").insert({
      name: `Live Browser Supplier Org ${ts}`,
      organization_type: "supplier",
    }).select().single();
    testEntities.orgs.push(sOrg.id);

    const sEmail = `live_supp_${ts}@harvestlink.test`;
    const { data: sUser } = await admin.auth.admin.createUser({
      email: sEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "supplier" },
    });
    testEntities.users.push(sUser.user.id);
    await admin.from("profiles").update({ role: "supplier", organization_id: sOrg.id, full_name: "Live Supplier Rep" }).eq("id", sUser.user.id);

    // Buyer
    const { data: bOrg } = await admin.from("organizations").insert({
      name: `Live Browser Buyer Org ${ts}`,
      organization_type: "buyer",
    }).select().single();
    testEntities.orgs.push(bOrg.id);

    const bEmail = `live_buyer_${ts}@harvestlink.test`;
    const { data: bUser } = await admin.auth.admin.createUser({
      email: bEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "buyer" },
    });
    testEntities.users.push(bUser.user.id);
    await admin.from("profiles").update({ role: "buyer", organization_id: bOrg.id, full_name: "Live Buyer Rep" }).eq("id", bUser.user.id);

    // Financier
    const fEmail = `live_fin_${ts}@harvestlink.test`;
    const { data: fUser } = await admin.auth.admin.createUser({
      email: fEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "financier" },
    });
    testEntities.users.push(fUser.user.id);
    await admin.from("profiles").update({ role: "financier", full_name: "Live Underwriter" }).eq("id", fUser.user.id);

    // Admin
    const aEmail = `live_adm_${ts}@harvestlink.test`;
    const { data: aUser } = await admin.auth.admin.createUser({
      email: aEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    testEntities.users.push(aUser.user.id);
    await admin.from("profiles").update({ role: "admin", full_name: "Live System Admin" }).eq("id", aUser.user.id);

    // Log in and get authentic cookies
    const supplierSession = await loginAndGetCookies(sEmail);
    const buyerSession = await loginAndGetCookies(bEmail);
    const financierSession = await loginAndGetCookies(fEmail);
    const adminSession = await loginAndGetCookies(aEmail);

    console.log("All 4 role browser sessions authenticated.\n");

    // -------------------------------------------------------------------------
    // 2. UNAUTHENTICATED ROUTE PROTECTION
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing Unauthenticated Route Protection ---");

    const unauthDashboard = await fetchRoute("/dashboard");
    assertCheck(
      "Unauthenticated",
      "Accessing /dashboard without session redirects to /login",
      unauthDashboard.status === 307 && unauthDashboard.location.includes("/login"),
      `Status: ${unauthDashboard.status}, Redirect: ${unauthDashboard.location}`
    );

    const unauthAdmin = await fetchRoute("/dashboard/admin");
    assertCheck(
      "Unauthenticated",
      "Accessing /dashboard/admin without session redirects to /login",
      unauthAdmin.status === 307 && unauthAdmin.location.includes("/login"),
      `Status: ${unauthAdmin.status}, Redirect: ${unauthAdmin.location}`
    );

    // -------------------------------------------------------------------------
    // 3. SUPPLIER BROWSER WORKFLOW
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Supplier Browser Workflow ---");

    const sDash = await fetchRoute("/dashboard/supplier", supplierSession.cookieHeader);
    assertCheck("Supplier", "Accesses /dashboard/supplier workspace", sDash.status === 200, `Status: ${sDash.status}`);

    const sPoList = await fetchRoute("/dashboard/purchase-orders", supplierSession.cookieHeader);
    assertCheck("Supplier", "Accesses /dashboard/purchase-orders list view", sPoList.status === 200, `Status: ${sPoList.status}`);

    const sInvoices = await fetchRoute("/dashboard/invoices", supplierSession.cookieHeader);
    assertCheck("Supplier", "Accesses /dashboard/invoices list view", sInvoices.status === 200, `Status: ${sInvoices.status}`);

    const sFinancing = await fetchRoute("/dashboard/financing", supplierSession.cookieHeader);
    assertCheck("Supplier", "Accesses /dashboard/financing application overview", sFinancing.status === 200, `Status: ${sFinancing.status}`);

    const sFinancingNew = await fetchRoute("/dashboard/financing/new", supplierSession.cookieHeader);
    assertCheck("Supplier", "Accesses /dashboard/financing/new application form", sFinancingNew.status === 200, `Status: ${sFinancingNew.status}`);

    // -------------------------------------------------------------------------
    // 4. BUYER BROWSER WORKFLOW
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing Buyer Browser Workflow ---");

    const bDash = await fetchRoute("/dashboard/buyer", buyerSession.cookieHeader);
    assertCheck("Buyer", "Accesses /dashboard/buyer workspace", bDash.status === 200, `Status: ${bDash.status}`);

    const bPoNew = await fetchRoute("/dashboard/purchase-orders/new", buyerSession.cookieHeader);
    assertCheck("Buyer", "Accesses /dashboard/purchase-orders/new creation interface", bPoNew.status === 200, `Status: ${bPoNew.status}`);

    // Buyer attempts to access /dashboard/admin -> Redirected to /dashboard/buyer
    const bAdminAccess = await fetchRoute("/dashboard/admin", buyerSession.cookieHeader);
    assertCheck(
      "Buyer",
      "Buyer attempting to access /dashboard/admin is redirected away to /dashboard/buyer",
      bAdminAccess.status === 307 && bAdminAccess.location.includes("/dashboard/buyer"),
      `Status: ${bAdminAccess.status}, Redirect: ${bAdminAccess.location}`
    );

    // -------------------------------------------------------------------------
    // 5. FINANCIER BROWSER WORKFLOW
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Financier Browser Workflow ---");

    const fDash = await fetchRoute("/dashboard/financier", financierSession.cookieHeader);
    assertCheck("Financier", "Accesses /dashboard/financier decision desk", fDash.status === 200, `Status: ${fDash.status}`);

    const fReviewQueue = await fetchRoute("/dashboard/financing", financierSession.cookieHeader);
    assertCheck("Financier", "Accesses /dashboard/financing underwriter review queue", fReviewQueue.status === 200, `Status: ${fReviewQueue.status}`);

    // -------------------------------------------------------------------------
    // 6. PLATFORM ADMIN BROWSER WORKFLOW
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Testing Platform Admin Browser Workflow ---");

    const aDash = await fetchRoute("/dashboard/admin", adminSession.cookieHeader);
    assertCheck("Admin", "Accesses /dashboard/admin platform control console", aDash.status === 200, `Status: ${aDash.status}`);

    // -------------------------------------------------------------------------
    // 7. CENTRAL DISPATCHER REDIRECTION
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Testing Central Dashboard Dispatcher ---");

    const sCentral = await fetchRoute("/dashboard", supplierSession.cookieHeader);
    assertCheck(
      "Dispatcher",
      "Supplier visiting /dashboard is automatically routed to /dashboard/supplier",
      sCentral.status === 307 && sCentral.location.includes("/dashboard/supplier"),
      `Redirect: ${sCentral.location}`
    );

    const bCentral = await fetchRoute("/dashboard", buyerSession.cookieHeader);
    assertCheck(
      "Dispatcher",
      "Buyer visiting /dashboard is automatically routed to /dashboard/buyer",
      bCentral.status === 307 && bCentral.location.includes("/dashboard/buyer"),
      `Redirect: ${bCentral.location}`
    );

    const fCentral = await fetchRoute("/dashboard", financierSession.cookieHeader);
    assertCheck(
      "Dispatcher",
      "Financier visiting /dashboard is automatically routed to /dashboard/financier",
      fCentral.status === 307 && fCentral.location.includes("/dashboard/financier"),
      `Redirect: ${fCentral.location}`
    );

    const aCentral = await fetchRoute("/dashboard", adminSession.cookieHeader);
    assertCheck(
      "Dispatcher",
      "Admin visiting /dashboard is automatically routed to /dashboard/admin",
      aCentral.status === 307 && aCentral.location.includes("/dashboard/admin"),
      `Redirect: ${aCentral.location}`
    );

  } finally {
    console.log("\n--- CLEANUP: Removing Live Test Entities ---");
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
  console.log(`LIVE BROWSER TEST SUMMARY: ${passedChecks}/${totalChecks} checks passed (${failedChecks} failed)`);
  console.log("======================================================================\n");

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runLiveBrowserWorkflowVerification().catch((err) => {
  console.error("Live browser test execution fatal error:", err);
  process.exit(1);
});
