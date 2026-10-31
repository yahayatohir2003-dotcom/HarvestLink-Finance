import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Sprout,
  PlusCircle,
  FileCheck2,
  Truck,
  Receipt,
  Warehouse,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Package,
  Coins,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { PoStatusBadge } from "@/components/purchase-orders/po-status-badge";
import { FinancingStatusBadge } from "@/components/financing/financing-status-badge";
import { FinancingRequestStatus } from "@/types/financing";
import { formatCurrencyNGN } from "@/lib/utils";

/**
 * Supplier Dashboard Workspace
 * Tailored for agricultural produce aggregators, farmers, and commodity suppliers.
 * Provides entry points for PO financing applications, milestone logs, and delivery tracking.
 */
export default async function SupplierDashboard() {
  const supabase = await createClient();

  // Verify server-side authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/supplier");
  }

  // 1. Fetch user's live profile from the 'profiles' database table
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  // Role Access Restriction: Redirect if not a supplier
  const userRole = profile?.role || (user.user_metadata?.role as string | undefined) || "supplier";
  if (userRole !== "supplier") {
    redirect(`/dashboard/${userRole}`);
  }

  // 2. Fetch linked organisation details from 'organizations' table
  let orgName = user.user_metadata?.organisation_name || "Agribusiness Supplier";
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

  const fullName = profile?.full_name || user.user_metadata?.full_name || "Supplier Partner";
  const userEmail = user.email || "";

  // 3. Query actual purchase orders assigned to this supplier organisation
  const admin = createAdminClient();
  const { data: recentOrders, count: poCount } = await admin
    .from("purchase_orders")
    .select("id, order_reference, order_date, expected_delivery_date, total_amount, status, buyer_organization_id", {
      count: "exact",
    })
    .eq("supplier_organization_id", profile?.organization_id || "")
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch buyer names for recent orders
  const buyerIds = (recentOrders || [])
    .map((o) => o.buyer_organization_id)
    .filter(Boolean) as string[];

  let buyerMap: Record<string, string> = {};
  if (buyerIds.length > 0) {
    const { data: buyers } = await admin
      .from("organizations")
      .select("id, name")
      .in("id", buyerIds);
    if (buyers) {
      buyerMap = Object.fromEntries(buyers.map((b) => [b.id, b.name]));
    }
  }

  // 4. Query actual financing requests submitted by this supplier
  const { count: financingCount } = await supabase
    .from("financing_requests")
    .select("*", { count: "exact", head: true })
    .eq("requested_by", user.id);

  // 5. Query recent financing applications for this supplier
  const { data: recentFinancing } = await admin
    .from("financing_requests")
    .select("id, purchase_order_id, requested_amount, status, purpose, created_at")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const finPoIds = (recentFinancing || []).map((f) => f.purchase_order_id);
  let finPoMap: Record<string, string> = {};
  if (finPoIds.length > 0) {
    const { data: finPos } = await admin
      .from("purchase_orders")
      .select("id, order_reference")
      .in("id", finPoIds);
    if (finPos) {
      finPoMap = Object.fromEntries(finPos.map((p) => [p.id, p.order_reference]));
    }
  }

  // 6. Query supplier invoices count and settled total
  const { data: supplierOrders } = await admin
    .from("purchase_orders")
    .select("id")
    .eq("supplier_organization_id", profile?.organization_id || "");

  const sPoIds = (supplierOrders || []).map((o) => o.id);
  let invoiceCount = 0;
  let settledTotal = 0;

  if (sPoIds.length > 0) {
    const { data: sInvoices } = await admin
      .from("invoices")
      .select("id, amount, status")
      .in("purchase_order_id", sPoIds);

    if (sInvoices) {
      invoiceCount = sInvoices.length;
      settledTotal = sInvoices
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + Number(i.amount), 0);
    }
  }

  // 7. Query active shipments in transit dynamically
  let transitTonnage = 0;
  let transitOrdersCount = 0;

  if (sPoIds.length > 0) {
    const { data: acceptedPos } = await admin
      .from("purchase_orders")
      .select("id")
      .eq("supplier_organization_id", profile?.organization_id || "")
      .eq("status", "accepted");

    const acceptedPoIds = (acceptedPos || []).map((p) => p.id);
    if (acceptedPoIds.length > 0) {
      const { data: transitMilestones } = await admin
        .from("fulfilment_milestones")
        .select("purchase_order_id")
        .in("purchase_order_id", acceptedPoIds)
        .in("milestone_type", ["loading", "in_transit"]);

      const transitPoIds = Array.from(new Set((transitMilestones || []).map((m) => m.purchase_order_id)));
      transitOrdersCount = transitPoIds.length;

      if (transitPoIds.length > 0) {
        const { data: tItems } = await admin
          .from("order_items")
          .select("quantity, unit")
          .in("purchase_order_id", transitPoIds);

        if (tItems) {
          transitTonnage = tItems.reduce((sum, item) => {
            const qty = Number(item.quantity) || 0;
            if (item.unit?.toLowerCase().includes("bag")) {
              return sum + (qty * 50) / 1000;
            }
            return sum + qty;
          }, 0);
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Universal Dashboard Header */}
      <DashboardHeader
        role="supplier"
        userName={fullName}
        organisationName={orgName}
        userEmail={userEmail}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Welcome Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-800 to-brand-900 p-6 sm:p-8 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700/60 px-2.5 py-1 text-xs font-semibold text-emerald-100 border border-emerald-500/30">
                <Sprout className="h-3.5 w-3.5" />
                Aggregator & Supplier Workspace
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {fullName}
              </h1>
              <p className="mt-1 text-sm text-emerald-100">
                Operating for: <span className="font-semibold text-white">{orgName}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard/financing/new"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow border border-emerald-500/40 transition-colors"
              >
                <Coins className="h-4 w-4 text-emerald-200" />
                Apply for PO Financing
              </Link>
              <Link
                href="/dashboard/purchase-orders"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-emerald-950 shadow hover:bg-emerald-50 transition-colors"
              >
                <FileCheck2 className="h-4 w-4 text-emerald-700" />
                View Assigned Orders
              </Link>
            </div>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Assigned Purchase Orders</span>
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">{poCount || 0} Orders</p>
            <span className="mt-1 block text-xs text-slate-500">
              Assigned from buyer procurement
            </span>
          </div>

          <Link
            href="/dashboard/financing"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase group-hover:text-blue-700">
              <span>Financing Applications</span>
              <Coins className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900 group-hover:text-blue-900">
              {financingCount || 0} Requests
            </p>
            <span className="mt-1 block text-xs text-blue-600 font-medium">
              Manage pipeline &rarr;
            </span>
          </Link>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Shipments in Transit</span>
              <Truck className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {transitTonnage > 0 ? `${transitTonnage.toLocaleString()} MT` : `${transitOrdersCount} Consignments`}
            </p>
            <span className="mt-1 block text-xs text-slate-500">
              {transitOrdersCount > 0 ? "Active freight en route to buyers" : "No active freight in transit"}
            </span>
          </div>

          <Link
            href="/dashboard/invoices"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-purple-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase group-hover:text-purple-700">
              <span>Commercial Invoices</span>
              <Receipt className="h-4 w-4 text-purple-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900 group-hover:text-purple-900">
              {invoiceCount} Invoices
            </p>
            <span className="mt-1 block text-xs text-purple-600 font-medium">
              {settledTotal > 0 ? `₦${settledTotal.toLocaleString()} settled` : "Manage billing &rarr;"}
            </span>
          </Link>

        </div>

        {/* Assigned Purchase Orders Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-emerald-700" />
                Assigned Purchase Orders
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Incoming purchase orders issued by FMCGs and corporate commodity buyers.
              </p>
            </div>
            <Link
              href="/dashboard/purchase-orders"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
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
                    <th className="px-4 py-3">Issuing Buyer</th>
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
                          className="hover:text-emerald-800 hover:underline"
                        >
                          {order.order_reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        {buyerMap[order.buyer_organization_id] || "Corporate Buyer"}
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
                          className="text-xs font-bold text-emerald-800 hover:underline"
                        >
                          Review Order
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
              <p className="text-xs text-slate-500">No purchase orders assigned to your organisation yet.</p>
              <p className="text-[11px] text-slate-400">
                When corporate buyers issue purchase orders to you, they will appear here for review and financing.
              </p>
            </div>
          )}
        </div>

        {/* Recent Financing Applications Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-700" />
                Recent Financing Applications
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Working capital applications submitted against confirmed purchase orders.
              </p>
            </div>
            <Link
              href="/dashboard/financing"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
            >
              View Pipeline ({financingCount || 0})
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentFinancing && recentFinancing.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">PO Reference</th>
                    <th className="px-4 py-3">Purpose</th>
                    <th className="px-4 py-3 text-right">Requested Capital</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submission Date</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recentFinancing.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-900 font-mono">
                        {finPoMap[req.purchase_order_id] || "PO N/A"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate">
                        {req.purpose}
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                        ₦{Number(req.requested_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <FinancingStatusBadge
                          status={req.status as FinancingRequestStatus}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                        {new Date(req.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/dashboard/financing/${req.id}`}
                          className="text-xs font-bold text-emerald-800 hover:underline"
                        >
                          View Dossier
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center space-y-2">
              <Coins className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">No financing applications submitted yet.</p>
              <div className="pt-2">
                <Link
                  href="/dashboard/financing/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800 transition-colors"
                >
                  <Coins className="h-3.5 w-3.5" />
                  Apply for PO Financing
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Integration Readiness Notice */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-emerald-950">
                Purchase Order Workflow Integrated
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                You can review assigned purchase orders, accept or decline buyer terms, and apply for
                pre-shipment financing against accepted purchase orders.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
