import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Receipt, PlusCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { InvoiceListView } from "@/components/invoices/invoice-list-view";
import { UserRole } from "@/types/auth";
import { EnrichedInvoiceRecord, SettlementRecord } from "@/types/invoice";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/invoices");
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile?.role || user.user_metadata?.role || "buyer") as UserRole;
  const fullName = profile?.full_name || user.user_metadata?.full_name || "Enterprise Partner";
  const userEmail = user.email || "";

  const admin = createAdminClient();

  // User organisation name
  let currentOrgName = user.user_metadata?.organisation_name || "Agribusiness Partner";
  if (profile?.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (org?.name) currentOrgName = org.name;
  }

  // 2. Query accessible purchase orders based on role and organization
  const isAdmin = userRole === "admin";
  const isFinancier = userRole === "financier";
  const isSupplier = userRole === "supplier";
  const isBuyer = userRole === "buyer";

  let poQuery = admin
    .from("purchase_orders")
    .select("id, order_reference, total_amount, status, buyer_organization_id, supplier_organization_id");

  if (isSupplier && profile?.organization_id) {
    poQuery = poQuery.eq("supplier_organization_id", profile.organization_id);
  } else if (isBuyer && profile?.organization_id) {
    poQuery = poQuery.eq("buyer_organization_id", profile.organization_id);
  }

  const { data: accessiblePos } = await poQuery;
  const poMap = Object.fromEntries((accessiblePos || []).map((p) => [p.id, p]));
  const accessiblePoIds = Object.keys(poMap);

  // 3. Query invoices
  let invoices: EnrichedInvoiceRecord[] = [];

  if (isAdmin || isFinancier || accessiblePoIds.length > 0) {
    let invQuery = admin
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isAdmin && !isFinancier) {
      invQuery = invQuery.in("purchase_order_id", accessiblePoIds);
    }

    const { data: rawInvoices } = await invQuery;

    // Collect all organization IDs from POs
    const orgIds = Array.from(
      new Set(
        (accessiblePos || []).flatMap((p) => [
          p.buyer_organization_id,
          p.supplier_organization_id,
        ]).filter(Boolean)
      )
    );

    let orgMap: Record<string, string> = {};
    if (orgIds.length > 0) {
      const { data: orgs } = await admin
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);
      if (orgs) {
        orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
      }
    }

    // Query settlements for these invoices
    const invIds = (rawInvoices || []).map((i) => i.id);
    let settlementsMap: Record<string, SettlementRecord[]> = {};
    if (invIds.length > 0) {
      const { data: settlements } = await admin
        .from("settlements")
        .select("*")
        .in("invoice_id", invIds);
      if (settlements) {
        for (const s of settlements) {
          if (s.invoice_id) {
            settlementsMap[s.invoice_id] = [
              ...(settlementsMap[s.invoice_id] || []),
              s,
            ];
          }
        }
      }
    }

    invoices = (rawInvoices || []).map((inv) => {
      const linkedPo = poMap[inv.purchase_order_id];
      return {
        ...inv,
        purchaseOrder: linkedPo
          ? {
              ...linkedPo,
              buyerOrgName: orgMap[linkedPo.buyer_organization_id] || "Corporate Buyer",
              supplierOrgName: orgMap[linkedPo.supplier_organization_id] || "Supplier Partner",
            }
          : undefined,
        settlements: settlementsMap[inv.id] || [],
      };
    });
  }

  const canCreateInvoice = isSupplier || isAdmin;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={fullName}
        organisationName={currentOrgName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Page Title & Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              href={isSupplier ? "/dashboard/supplier" : isBuyer ? "/dashboard/buyer" : "/dashboard"}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            <div className="mt-2 flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Commercial Invoices
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Track agricultural trade invoices, due dates, and non-custodial settlement status
            </p>
          </div>

          {canCreateInvoice && (
            <Link
              href="/dashboard/invoices/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-900 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Issue Commercial Invoice
            </Link>
          )}
        </div>

        {/* Invoice List View Component */}
        <InvoiceListView
          invoices={invoices}
          userRole={userRole}
          canCreateInvoice={canCreateInvoice}
        />

      </main>
    </div>
  );
}
