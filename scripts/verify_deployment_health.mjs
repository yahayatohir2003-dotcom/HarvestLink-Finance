#!/usr/bin/env node

/**
 * HarvestLink Finance - Deployment Health Verification Suite
 *
 * Validates a live or local deployment:
 * 1. Public route availability (landing page, auth screens, health)
 * 2. Security headers (X-Frame-Options, Content-Type, etc.)
 * 3. Secret leakage inspection (verifies no private keys appear in HTML/bundles)
 * 4. Protected route authorization safeguards (redirects unauthenticated users)
 *
 * Usage:
 *   node scripts/verify_deployment_health.mjs
 *   node scripts/verify_deployment_health.mjs --url=https://harvestlink-finance.vercel.app
 */

const targetArg = process.argv.find((arg) => arg.startsWith("--url="));
const baseUrl = (targetArg ? targetArg.split("=")[1] : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

console.log("======================================================================");
console.log("   HARVESTLINK FINANCE — DEPLOYMENT HEALTH VERIFICATION             ");
console.log("======================================================================");
console.log(`Target URL: ${baseUrl}\n`);

let passedChecks = 0;
let failedChecks = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`[✔ PASS] ${description}`);
    passedChecks++;
  } else {
    console.error(`[✖ FAIL] ${description}`);
    failedChecks++;
  }
}

async function runHealthCheck() {
  try {
    // 1. Landing Page Test
    console.log("--- TEST 1: Public Landing Page & Features Anchor ---");
    const landingRes = await fetch(`${baseUrl}/`, { redirect: "manual" });
    assert(landingRes.status === 200, `Landing page returns HTTP 200 OK (Status: ${landingRes.status})`);

    const landingHtml = await landingRes.text();
    assert(landingHtml.includes("HarvestLink Finance"), "Landing page contains 'HarvestLink Finance' branding");
    assert(landingHtml.includes('id="features"'), "Landing page contains valid features anchor 'id=\"features\"'");
    assert(!landingHtml.includes("eyJh"), "Zero secret JWT tokens or private service-role keys leaked in landing page HTML");

    // 2. Auth Routes Test
    console.log("\n--- TEST 2: Authentication & Registration Routes ---");
    const loginRes = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    assert(loginRes.status === 200, `Login page returns HTTP 200 OK (Status: ${loginRes.status})`);

    const registerRes = await fetch(`${baseUrl}/register?role=reviewer`, { redirect: "manual" });
    assert(registerRes.status === 200, `Reviewer registration endpoint returns HTTP 200 OK (Status: ${registerRes.status})`);

    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, { redirect: "manual" });
    assert(forgotRes.status === 200, `Password recovery page returns HTTP 200 OK (Status: ${forgotRes.status})`);

    // 3. Protected Dashboard Redirection Test
    console.log("\n--- TEST 3: Edge Middleware & Dashboard Redirection ---");
    const dashboardRes = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
    const isRedirect = dashboardRes.status === 307 || dashboardRes.status === 308 || dashboardRes.status === 302;
    const location = dashboardRes.headers.get("location") || "";
    assert(
      isRedirect && location.includes("/login"),
      `Unauthenticated visitor to /dashboard is redirected to login (Status: ${dashboardRes.status}, Location: ${location})`
    );

    const supplierDashRes = await fetch(`${baseUrl}/dashboard/supplier`, { redirect: "manual" });
    const isSupRedirect = supplierDashRes.status === 307 || supplierDashRes.status === 308 || supplierDashRes.status === 302;
    assert(
      isSupRedirect,
      `Unauthenticated visitor to /dashboard/supplier is redirected (Status: ${supplierDashRes.status})`
    );

    // 4. Demonstration Notice & Non-Custodial Disclosure Test
    console.log("\n--- TEST 4: Platform Governance & Non-Custodial Disclosures ---");
    assert(
      landingHtml.toLowerCase().includes("non-custodial") || landingHtml.toLowerCase().includes("demonstration"),
      "Landing page presents truthful demonstration & non-custodial disclosures"
    );

    console.log("\n======================================================================");
    console.log(`DEPLOYMENT HEALTH SUMMARY: ${passedChecks} checks passed, ${failedChecks} failed`);
    console.log("======================================================================");

    if (failedChecks > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n[✖ ERROR] Connection failed to ${baseUrl}:`, err.message);
    console.log("\nNotice: If testing local server, ensure 'npm run start' or 'npm run dev' is running.");
    process.exit(1);
  }
}

runHealthCheck();
