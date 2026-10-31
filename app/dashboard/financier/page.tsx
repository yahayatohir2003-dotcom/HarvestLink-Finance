import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Scale,
  FileCheck,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  FolderOpen,
  FileSearch,
  ArrowUpRight,
  Coins,
  Building,
  Receipt,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { FinancingStatusBadge } from "@/components/financing/financing-status-badge";
import { FinancingRequestStatus } from "@/types/financing";

/**
 * Financing Reviewer / Financier Workspace
 * Dedicated desk for institutional lenders, credit analysts, and financing partners.
 * In accordance with project rules, all financing decisions remain exclusively with the financing partner.
 */
export default async function FinancierDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/financier");
  }

  // 1. Fetch user's live profile from the 'profiles' database table
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  // Role Access Restriction: Redirect if not a financier / financing reviewer
  const userRole = profile?.role || (user.user_metadata?.role as string | undefined) || "financier";
  if (userRole !== "financier" && userRole !== "reviewer" && userRole !== "admin") {
    redirect(`/dashboard/${userRole}`);
  }

  const admin = createAdminClient();

  // 2. Fetch linked financing institution details from 'organizations' table
  let orgName = user.user_metadata?.organisation_name || "Financing Institution";
  if (profile?.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (org?.name) {
      orgName = org.name;
    }
  }

  const fullName = profile?.full_name || user.user_metadata?.full_name || "Credit Underwriter";
  const userEmail = user.email || "";

  // 3. Query active review queue (matching check constraint: 'submitted' or 'under_review')
  const { count: pendingRequestsCount } = await admin
    .from("financing_requests")
    .select("*", { count: "exact", head: true })
    .in("status", ["submitted", "under_review"]);

  // 4. Query reviews completed by this reviewer
  const { count: completedReviewsCount } = await admin
    .from("financing_reviews")
    .select("*", { count: "exact", head: true })
    .eq("reviewer_id", user.id);

  // 5. Query verification documents in transaction vault
  const { count: documentsCount } = await admin
    .from("documents")
    .select("*", { count: "exact", head: true });

  // 6. Query approved requests count
  const { count: approvedCount } = await admin
    .from("financing_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");

  // 7. Query top applications in the queue awaiting review
  const { data: queueRequests } = await admin
    .from("financing_requests")
    .select("id, purchase_order_id, requested_amount, status, purpose, created_at, requested_by")
    .in("status", ["submitted", "under_review"])
    .order("created_at", { ascending: false })
    .limit(5);

  const poIds = (queueRequests || []).map((q) => q.purchase_order_id);
  let poMap: Record<string, { order_reference: string; buyer_name: string; total_amount: number }> = {};
  if (poIds.length > 0) {
    const { data: pos } = await admin
      .from("purchase_orders")
      .select("id, order_reference, total_amount, buyer_organization_id")
      .in("id", poIds);

    if (pos) {
      const buyerIds = Array.from(new Set(pos.map((p) => p.buyer_organization_id)));
      let buyerMap: Record<string, string> = {};
      if (buyerIds.length > 0) {
        const { data: buyers } = await admin
          .from("organizations")
          .select("id, name")
          .in("id", buyerIds);
        if (buyers) buyerMap = Object.fromEntries(buyers.map((b) => [b.id, b.name]));
      }

      pos.forEach((p) => {
        poMap[p.id] = {
          order_reference: p.order_reference,
          total_amount: Number(p.total_amount),
          buyer_name: buyerMap[p.buyer_organization_id] || "Corporate Buyer",
        };
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role="financier"
        userName={fullName}
        organisationName={orgName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Welcome Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-950 p-6 sm:p-8 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-800/60 px-2.5 py-1 text-xs font-semibold text-blue-100 border border-blue-500/30">
                <Scale className="h-3.5 w-3.5" />
                Institutional Financing Reviewer Desk
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {fullName}
              </h1>
              <p className="mt-1 text-sm text-blue-100">
                Underwriting for: <span className="font-semibold text-white">{orgName}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard/financing"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-blue-950 shadow hover:bg-blue-50 transition-colors"
                title="Review incoming financing applications"
              >
                <FileSearch className="h-4 w-4 text-blue-800" />
                Review Applications ({pendingRequestsCount || 0})
              </Link>
              <Link
                href="/dashboard/invoices"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700/80 border border-blue-400/40 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-600 transition-colors"
                title="Inspect commercial invoices for settlement underwriting"
              >
                <Receipt className="h-4 w-4" />
                Invoices & Settlements
              </Link>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          <Link
            href="/dashboard/financing"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase group-hover:text-blue-700">
              <span>Underwriting Queue</span>
              <FolderOpen className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900 group-hover:text-blue-900">
              {pendingRequestsCount || 0} Requests
            </p>
            <span className="mt-1 block text-xs text-blue-600 font-medium">
              Awaiting underwriting decisions &rarr;
            </span>
          </Link>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Approved Facilities</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {approvedCount || 0} Approved
            </p>
            <span className="mt-1 block text-xs text-emerald-700 font-medium">
              Confirmed credit commitments
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Reviews Completed</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {completedReviewsCount || 0} Reviewed
            </p>
            <span className="mt-1 block text-xs text-slate-500">
              Recorded in financing_reviews
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Document Vault</span>
              <FileCheck className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {documentsCount || 0} Files
            </p>
            <span className="mt-1 block text-xs text-slate-500 font-mono">
              transaction-documents
            </span>
          </div>

        </div>

        {/* Priority Underwriting Queue Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-800" />
                Active Underwriting Review Queue
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Priority applications awaiting credit assessment and underwriting remarks.
              </p>
            </div>
            <Link
              href="/dashboard/financing"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:text-blue-950 transition-colors"
            >
              View Full Queue ({pendingRequestsCount || 0})
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {queueRequests && queueRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">PO Reference</th>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3 text-right">Requested Capital</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submission Date</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {queueRequests.map((req) => {
                    const poInfo = poMap[req.purchase_order_id];
                    return (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-900 font-mono">
                          {poInfo?.order_reference || "PO N/A"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {poInfo?.buyer_name || "Corporate Buyer"}
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
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900 hover:bg-blue-100 transition-colors shadow-sm"
                          >
                            <span>Underwrite</span>
                            <ArrowUpRight className="h-3 w-3 text-blue-700" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Underwriting queue is clear!</p>
              <p className="text-[11px] text-slate-400">
                All submitted financing applications have been reviewed.
              </p>
            </div>
          )}
        </div>

        {/* Operating Principle Card */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-blue-950">
                Financing Governance Notice
              </h3>
              <p className="text-xs text-blue-900 leading-relaxed">
                In strict compliance with HarvestLink Finance governance, all financing decisions
                remain exclusively with the financing partner. The platform facilitates document verification,
                fraud mitigation, and milestone auditing, but does not conduct balance-sheet lending or automated disbursements.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
