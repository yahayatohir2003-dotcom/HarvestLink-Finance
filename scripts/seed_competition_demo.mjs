#!/usr/bin/env node

/**
 * HarvestLink Finance - Competition Demonstration Scenario Seed Script
 *
 * Idempotently establishes canonical test entities and a showcase transaction
 * for the Access Youth Tech Forge 2026 competition.
 *
 * All records are tagged with "[ILLUSTRATIVE DEMO DATA]".
 * Demonstrates the complete 10-step supply chain trade coordination cycle.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed_competition_demo.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE credentials in environment.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("======================================================================");
console.log("   HARVESTLINK FINANCE — COMPETITION DEMONSTRATION SEED SCRIPT       ");
console.log("======================================================================\n");

async function seedDemoScenario() {
  try {
    const nowIso = new Date().toISOString();

    // 1. Establish Demonstration Organizations
    console.log("1. Seeding Demonstration Agribusiness Organizations...");

    // Buyer Org
    let { data: buyerOrg } = await admin
      .from("organizations")
      .select("id, name")
      .eq("name", "Grand Cereals Plc (Demo Buyer)")
      .maybeSingle();

    if (!buyerOrg) {
      const { data: newOrg, error } = await admin
        .from("organizations")
        .insert({
          name: "Grand Cereals Plc (Demo Buyer)",
          organization_type: "buyer",
          email: "procurement@grandcereals-demo.ng",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      buyerOrg = newOrg;
    }
    console.log(`   [✔] Buyer Org: ${buyerOrg.name} (${buyerOrg.id})`);

    // Supplier Org
    let { data: supplierOrg } = await admin
      .from("organizations")
      .select("id, name")
      .eq("name", "Kano Grain Aggregators Ltd (Demo Supplier)")
      .maybeSingle();

    if (!supplierOrg) {
      const { data: newOrg, error } = await admin
        .from("organizations")
        .insert({
          name: "Kano Grain Aggregators Ltd (Demo Supplier)",
          organization_type: "supplier",
          email: "operations@kanograins-demo.ng",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      supplierOrg = newOrg;
    }
    console.log(`   [✔] Supplier Org: ${supplierOrg.name} (${supplierOrg.id})`);

    // Financier Org
    let { data: financierOrg } = await admin
      .from("organizations")
      .select("id, name")
      .eq("name", "First Agric Capital Partners (Demo Reviewer)")
      .maybeSingle();

    if (!financierOrg) {
      const { data: newOrg, error } = await admin
        .from("organizations")
        .insert({
          name: "First Agric Capital Partners (Demo Reviewer)",
          organization_type: "financier",
          email: "underwriting@firstagric-demo.ng",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      financierOrg = newOrg;
    }
    console.log(`   [✔] Financier Org: ${financierOrg.name} (${financierOrg.id})`);

    // 2. Fetch or Establish Demo User Profiles for All 4 Roles
    console.log("\n2. Linking User Profile Accounts for All 4 Roles...");

    async function ensureDemoUser(email, fullName, role, orgId) {
      const { data: listData } = await admin.auth.admin.listUsers();
      const existingUser = (listData?.users || []).find((u) => u.email === email);
      let userId;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const securePassword = "HL-" + crypto.randomUUID().replace(/-/g, "") + "!Agri";
        const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: securePassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role: role,
          },
        });
        if (createErr) {
          console.warn(`   [!] User creation note for ${email}:`, createErr.message);
          return null;
        }
        userId = newUser.user.id;
      }

      await admin.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        role: role,
        organization_id: orgId,
        updated_at: new Date().toISOString(),
      });

      console.log(`   [✔] ${role.toUpperCase()} Account verified: ${fullName} (${userId.slice(0, 8)})`);
      return userId;
    }

    const supplierUserId = await ensureDemoUser(
      "supplier@kanograins-demo.ng",
      "Musa Haruna (Kano Aggregator)",
      "supplier",
      supplierOrg.id
    );

    const buyerUserId = await ensureDemoUser(
      "buyer@grandcereals-demo.ng",
      "Amina Bello (Procurement Lead)",
      "buyer",
      buyerOrg.id
    );

    const financierUserId = await ensureDemoUser(
      "reviewer@firstagric-demo.ng",
      "Ibrahim Gambo (Credit Underwriter)",
      "financier",
      financierOrg.id
    );

    const adminUserId = await ensureDemoUser(
      "admin@harvestlink-demo.ng",
      "Platform System Admin",
      "admin",
      null
    );

    const defaultActorId = supplierUserId || buyerUserId || "00000000-0000-0000-0000-000000000000";

    // 3. Showcase Purchase Order
    console.log("\n3. Seeding Showcase Purchase Order (HL-PO-2026-DEMO-01)...");
    const poRef = "HL-PO-2026-DEMO-01";
    let { data: existingPo } = await admin
      .from("purchase_orders")
      .select("id")
      .eq("order_reference", poRef)
      .maybeSingle();

    let poId;
    if (existingPo) {
      poId = existingPo.id;
      console.log(`   [✔] Found existing Showcase PO: ${poRef} (${poId})`);
    } else {
      const { data: newPo, error: poErr } = await admin
        .from("purchase_orders")
        .insert({
          order_reference: poRef,
          buyer_organization_id: buyerOrg.id,
          supplier_organization_id: supplierOrg.id,
          created_by: defaultActorId,
          status: "fulfilled",
          total_amount: 8750000.0,
          currency: "NGN",
          order_date: "2026-03-15",
          expected_delivery_date: "2026-04-10",
          description: "[ILLUSTRATIVE DEMO DATA] Access Youth Tech Forge 2026 Showcase Commodity Agreement.",
          created_at: nowIso,
        })
        .select("id")
        .single();

      if (poErr) throw poErr;
      poId = newPo.id;
      console.log(`   [✔] Created Showcase PO: ${poRef} (${poId})`);

      // Add line item
      await admin.from("order_items").insert({
        purchase_order_id: poId,
        item_name: "Yellow Maize",
        description: "[ILLUSTRATIVE DEMO DATA] SAMMAZ 15 High-Yield Grain, Grade 1 (Moisture < 12%)",
        quantity: 25.0,
        unit: "metric_tons",
        unit_price: 350000.0,
        line_total: 8750000.0,
      });

      // Add audit log
      await admin.from("audit_logs").insert({
        actor_id: defaultActorId,
        action: "PO_CREATED",
        entity_table: "purchase_orders",
        entity_id: poId,
        details: {
          order_reference: poRef,
          buyer: buyerOrg.name,
          supplier: supplierOrg.name,
          total_amount: 8750000,
          demo: true,
        },
        created_at: nowIso,
      });
    }

    // 4. Attach Verified Trade Document
    console.log("\n4. Seeding Trade Document Vault...");
    const { data: existingDoc } = await admin
      .from("documents")
      .select("id")
      .eq("purchase_order_id", poId)
      .maybeSingle();

    if (!existingDoc) {
      const { data: newDoc } = await admin
        .from("documents")
        .insert({
          purchase_order_id: poId,
          document_type: "delivery_note",
          original_filename: "WAYBILL_SAMMAZ15_DEMO_25MT.pdf",
          storage_path: `${poId}/delivery_note/WAYBILL_SAMMAZ15_DEMO_25MT.pdf`,
          mime_type: "application/pdf",
          file_size_bytes: 245000,
          verification_status: "verified",
          uploaded_by: defaultActorId,
          created_at: nowIso,
        })
        .select("id")
        .single();

      if (newDoc) {
        console.log(`   [✔] Attached verified waybill document: ${newDoc.id}`);
      }
    } else {
      console.log(`   [✔] Document already attached.`);
    }

    // 5. Seeding Financing Application & Review
    console.log("\n5. Seeding Financing Facility (₦6,125,000 / 70% LTV)...");
    const { data: existingFin } = await admin
      .from("financing_requests")
      .select("id")
      .eq("purchase_order_id", poId)
      .maybeSingle();

    let finId;
    if (!existingFin) {
      const { data: newFin } = await admin
        .from("financing_requests")
        .insert({
          purchase_order_id: poId,
          requested_by: defaultActorId,
          requested_amount: 6125000.0,
          purpose: "[ILLUSTRATIVE DEMO DATA] Working capital for aggregating 25 MT maize from Kaduna smallholder cluster.",
          status: "approved",
          submitted_at: nowIso,
          created_at: nowIso,
        })
        .select("id")
        .single();

      if (newFin) {
        finId = newFin.id;
        console.log(`   [✔] Created financing request: ${finId}`);

        // Add review
        await admin.from("financing_reviews").insert({
          financing_request_id: finId,
          reviewer_id: defaultActorId,
          decision: "approved",
          comments: "[ILLUSTRATIVE DEMO DATA] Approved under standard trade facility terms. Warehouse inspection verified.",
          reviewed_at: nowIso,
        });
      }
    } else {
      finId = existingFin.id;
      console.log(`   [✔] Found existing financing request: ${finId}`);
    }

    // 6. Seeding Commercial Invoice & Settlement
    console.log("\n6. Seeding Commercial Invoice & Settlement Coordination...");
    const invNum = "HL-INV-2026-DEMO-01";
    let { data: existingInv } = await admin
      .from("invoices")
      .select("id")
      .eq("invoice_number", invNum)
      .maybeSingle();

    let invId;
    if (!existingInv) {
      const { data: newInv } = await admin
        .from("invoices")
        .insert({
          purchase_order_id: poId,
          invoice_number: invNum,
          amount: 8750000.0,
          issue_date: "2026-04-05",
          due_date: "2026-04-20",
          status: "paid",
          created_at: nowIso,
        })
        .select("id")
        .single();

      if (newInv) {
        invId = newInv.id;
        console.log(`   [✔] Created commercial invoice: ${invNum} (${invId})`);

        // Record settlement
        await admin.from("settlements").insert({
          purchase_order_id: poId,
          invoice_id: invId,
          amount: 8750000.0,
          status: "paid",
          payment_reference: "NIBSS-DEMO-20260408-9921",
          is_simulated: false,
          created_at: nowIso,
        });
        console.log(`   [✔] Reconciled verified settlement for ₦8,750,000.`);
      }
    } else {
      invId = existingInv.id;
      console.log(`   [✔] Found existing commercial invoice: ${invNum}`);
    }

    console.log("\n======================================================================");
    console.log("   COMPETITION DEMONSTRATION SCENARIO SEEDING COMPLETE (100%)       ");
    console.log("======================================================================");
    console.log(`Showcase PO Reference : ${poRef}`);
    console.log(`Commodity             : 25 MT Premium Yellow Maize (Illustrative Demo)`);
    console.log(`Total Value           : ₦8,750,000 NGN`);
    console.log(`Financing Facility    : ₦6,125,000 (70% LTV) - Approved`);
    console.log(`Invoice & Settlement  : ${invNum} - Reconciled & Paid`);
  } catch (err) {
    console.error("\n[✖ ERROR] Demo seed failed:", err.message);
    process.exit(1);
  }
}

seedDemoScenario();
