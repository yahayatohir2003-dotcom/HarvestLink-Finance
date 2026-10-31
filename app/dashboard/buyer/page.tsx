import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  Truck,
  Receipt,
  Scale,
  ArrowUpRight,
  Package,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { PoStatusBadge } from "@/components/purchase-orders/po-status-badge";
import { formatCurrencyNGN } from "@/lib/utils";

/**
 * Buyer Dashboard Workspace
 * Tailored for Nigerian food processors, FMCGs, and commodity buyers.
 * Enables purchase order issuance, shipment tracking, and delivery confirmations.
 */
export default async function BuyerDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/buyer");
  }

  // 1. Fetch user's live profile from the 'profiles' database table
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  // Role Access Restriction: Redirect if not a buyer
  const userRole = profile?.role || (user.user_metadata?.role as string | undefined) || "buyer";
  if (userRole !== "buyer") {
    redirect(`/dashboard/${userRole}`);
  }

  // 2. Fetch linked organisation details from 'organizations' table
  let orgName = user.user_metadata?.organisation_name || "Food Processing Co.";
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (org?.name) {
      orgName = org.name;
    }
  }

  const fullName = profile?.full_name || user.user_metadata?.full_name || "Corporate Buyer";
  const userEmail = user.email || "";

  // 3. Query purchase orders issued by this buyer organization
  const admin = createAdminClient();
  const { data: recentOrders, count: poCount } = await admin
    .from("purchase_orders")
    .select("id, order_reference, order_date, expected_delivery_date, total_amount, status, supplier_organization_id", {
      count: "exact",
    })
    .eq("buyer_organization_id", profile?.organization_id || "")
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch supplier names for recent orders
  const supplierIds = (recentOrders || [])
    .map((o) => o.supplier_organization_id)
    .filter(Boolean) as string[];

  let supplierMap: Record<string, string> = {};
  if (supplierIds.length > 0) {
    const { data: suppliers } = await admin
      .from("organizations")
      .select("id, name")
      .in("id", supplierIds);
    if (suppliers) {
      supplierMap = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));
    }
  }

  // 4. Query delivery confirmations pending or received
  const { count: confirmationsCount } = await supabase
    .from("delivery_confirmations")
    .select("*", { count: "exact", head: true })
    .eq("confirmed_by", user.id);

  // 5. Query invoices for buyer purchase orders
  const { data: buyerOrders } = await admin
    .from("purchase_orders")
    .select("id")
    .eq("buyer_organization_id", profile?.organization_id || "");

  const bPoIds = (buyerOrders || []).map((o) => o.id);
  let buyerInvoiceCount = 0;
  let buyerSettledTotal = 0;

  if (bPoIds.length > 0) {
    const { data: bInvoices } = await admin
      .from("invoices")
      .select("id, amount, status")
      .in("purchase_order_id", bPoIds);

    if (bInvoices) {
      buyerInvoiceCount = bInvoices.length;
      buyerSettledTotal = bInvoices
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + Number(i.amount), 0);
    }
  }

  // 6. Query inbound shipments dynamically from active POs with transit milestones
  let inboundShipmentsCount = 0;
  if (bPoIds.length > 0) {
    const { data: bAcceptedPos } = await admin
      .from("purchase_orders")
      .select("id")
      .eq("buyer_organization_id", profile?.organization_id || "")
      .eq("status", "accepted");

    const bAcceptedPoIds = (bAcceptedPos || []).map((p) => p.id);
    if (bAcceptedPoIds.length > 0) {
      const { data: bTransitMilestones } = await admin
        .from("fulfilment_milestones")
        .select("purchase_order_id")
        .in("purchase_order_id", bAcceptedPoIds)
        .in("milestone_type", ["loading", "in_transit"]);

      const uniqueTransitPoIds = Array.from(new Set((bTransitMilestones || []).map((m) => m.purchase_order_id)));
      inboundShipmentsCount = uniqueTransitPoIds.length;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role="buyer"
        userName={fullName}
        organisationName={orgName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Welcome Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-800 to-amber-950 p-6 sm:p-8 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-700/60 px-2.5 py-1 text-xs font-semibold text-amber-100 border border-amber-500/30">
                <Building2 className="h-3.5 w-3.5" />
                Corporate Buyer & Processor Workspace
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {fullName}
              </h1>
              <p className="mt-1 text-sm text-amber-100">
                Operating for: <span className="font-semibold text-white">{orgName}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/purchase-orders/new"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-amber-950 shadow hover:bg-amber-50 transition-colors"
              >
                <PlusCircle className="h-4 w-4 text-amber-800" />
                Issue New Purchase Order
              </Link>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Active POs Issued</span>
              <FileSpreadsheet className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">{poCount || 0} POs</p>
            <span className="mt-1 block text-xs text-slate-500">
              Synchronized from purchase_orders
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Inbound Shipments</span>
              <Truck className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {inboundShipmentsCount} Inbound
            </p>
            <span className="mt-1 block text-xs text-slate-500">
              {inboundShipmentsCount > 0 ? "Consignments en route to facility" : "No active consignments en route"}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Confirmations Recorded</span>
              <Scale className="h-4 w-4 text-orange-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">{confirmationsCount || 0} Records</p>
            <span className="mt-1 block text-xs text-slate-500">
              delivery_confirmations
            </span>
          </div>

          <Link
            href="/dashboard/invoices"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase group-hover:text-emerald-700">
              <span>Billed Invoices</span>
              <Receipt className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900 group-hover:text-emerald-950">
              {buyerInvoiceCount} Invoices
            </p>
            <span className="mt-1 block text-xs text-emerald-700 font-medium">
              {buyerSettledTotal > 0 ? `₦${buyerSettledTotal.toLocaleString()} paid` : "View payables &rarr;"}
            </span>
          </Link>

        </div>

        {/* Recent Purchase Orders Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-amber-700" />
                Recent Purchase Orders
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest commercial procurement agreements issued to produce suppliers.
              </p>
            </div>
            <Link
              href="/dashboard/purchase-orders"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 transition-colors"
            >
              View All ({poCount || 0})
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentOrders && recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">PO Reference</th>
                    <th className="px-4 py-3">Assigned Supplier</th>
                    <th className="px-4 py-3">Issue Date</th>
                    <th className="px-4 py-3 text-right">Order Amount (₦)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        <Link
                          href={`/dashboard/purchase-orders/${order.id}`}
                          className="hover:text-amber-800 hover:underline"
                        >
                          {order.order_reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        {order.supplier_organization_id
                          ? supplierMap[order.supplier_organization_id] || "Supplier"
                          : "Unassigned"}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{order.order_date}</td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                        {formatCurrencyNGN(Number(order.total_amount))}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <PoStatusBadge status={order.status} size="sm" />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/dashboard/purchase-orders/${order.id}`}
                          className="text-xs font-bold text-amber-800 hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center space-y-2">
              <Package className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">No purchase orders issued yet.</p>
              <Link
                href="/dashboard/purchase-orders/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-900"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Issue Your First Order
              </Link>
            </div>
          )}
        </div>

        {/* Readiness Info */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-950">
                Purchase Order Management Active
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                Purchase Order creation, multi-item commodity pricing, and automatic calculations are live.
                Orders issued here will synchronize automatically with suppliers and supply-chain financiers.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
