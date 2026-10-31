import React from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  Building,
  FileCheck2,
  Calendar,
  Layers,
  History,
  FileText,
  User,
  ShieldAlert,
  Percent,
  Truck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { FinancingStatusBadge } from "@/components/financing/financing-status-badge";
import { FinancingDecisionCard } from "@/components/financing/financing-decision-card";
import { DocumentListCard } from "@/components/documents/document-list-card";
import { MilestoneStatusBadge } from "@/components/fulfilment/milestone-status-badge";
import { DeliveryStatusBadge } from "@/components/fulfilment/delivery-status-badge";
import { DocumentRecord } from "@/types/document";
import { UserRole } from "@/types/auth";
import { FinancingReviewRecord } from "@/types/financing";

interface FinancingDetailsPageProps {
  params: {
    id: string;
  };
}

export default async function FinancingDetailsPage({
  params,
}: FinancingDetailsPageProps) {
  const requestId = params.id;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/dashboard/financing/${requestId}`);
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile?.role || "supplier") as UserRole;
  const admin = createAdminClient();

  // 2. Fetch financing request record
  const { data: fr, error: frErr } = await admin
    .from("financing_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (frErr || !fr) {
    notFound();
  }

  // 3. Fetch linked purchase order
  const { data: po } = await admin
    .from("purchase_orders")
    .select("id, order_reference, total_amount, status, order_date, expected_delivery_date, buyer_organization_id, supplier_organization_id, description")
    .eq("id", fr.purchase_order_id)
    .maybeSingle();

  if (!po) {
    notFound();
  }

  // 4. Access Authorization Guard:
  // Buyers are strictly prohibited from viewing confidential financing applications and underwriting comments.
  if (userRole === "buyer") {
    redirect(`/dashboard/purchase-orders/${po.id}`);
  }

  // Permitted parties:
  // - Requester themselves
  // - Members of the supplying organisation
  // - Financing reviewers ('financier')
  // - System administrators ('admin')
  const isRequester = fr.requested_by === user.id;
  const isSupplierOrg = profile?.organization_id === po.supplier_organization_id;
  const isFinancier = userRole === "financier";
  const isAdmin = userRole === "admin";

  if (!isRequester && !isSupplierOrg && !isFinancier && !isAdmin) {
    redirect("/dashboard/financing");
  }

  // 5. Fetch organizations
  const { data: buyerOrg } = await admin
    .from("organizations")
    .select("id, name, registration_number, address, email, phone")
    .eq("id", po.buyer_organization_id)
    .maybeSingle();

  const { data: supplierOrg } = await admin
    .from("organizations")
    .select("id, name, registration_number, address, email, phone")
    .eq("id", po.supplier_organization_id)
    .maybeSingle();

  // 6. Fetch PO commodities line items
  const { data: items } = await admin
    .from("order_items")
    .select("*")
    .eq("purchase_order_id", po.id)
    .order("created_at", { ascending: true });

  // 7. Fetch requester profile
  const { data: requesterProfile } = await admin
    .from("profiles")
    .select("id, full_name, role, phone")
    .eq("id", fr.requested_by)
    .maybeSingle();

  // 8. Fetch financing review decisions
  const { data: rawReviews } = await admin
    .from("financing_reviews")
    .select("*")
    .eq("financing_request_id", requestId)
    .order("reviewed_at", { ascending: false });

  // Fetch reviewer names
  const reviewerIds = Array.from(new Set((rawReviews || []).map((r) => r.reviewer_id)));
  let reviewerMap: Record<string, any> = {};
  if (reviewerIds.length > 0) {
    const { data: revProfiles } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .in("id", reviewerIds);
    if (revProfiles) {
      reviewerMap = Object.fromEntries(revProfiles.map((p) => [p.id, p]));
    }
  }

  const reviews: FinancingReviewRecord[] = (rawReviews || []).map((r) => ({
    ...r,
    reviewerProfile: reviewerMap[r.reviewer_id],
  }));

  // 9. Fetch documents attached to this financing request or linked purchase order
  const { data: rawDocs } = await admin
    .from("documents")
    .select("*")
    .or(`financing_request_id.eq.${requestId},purchase_order_id.eq.${po.id}`)
    .order("created_at", { ascending: false });

  // Fetch uploader names
  const uploaderIds = Array.from(new Set((rawDocs || []).map((d) => d.uploaded_by)));
  let uploaderMap: Record<string, string> = {};
  if (uploaderIds.length > 0) {
    const { data: uploaders } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds);
    if (uploaders) {
      uploaderMap = Object.fromEntries(uploaders.map((u) => [u.id, u.full_name]));
    }
  }

  const attachedDocs: DocumentRecord[] = (rawDocs || []).map((d) => ({
    ...d,
    uploaderName: uploaderMap[d.uploaded_by] || "Counterparty Representative",
  }));

  // 10. Fetch audit logs for this financing request
  const { data: auditLogs } = await admin
    .from("audit_logs")
    .select("id, actor_id, action, details, created_at")
    .eq("entity_table", "financing_requests")
    .eq("entity_id", requestId)
    .order("created_at", { ascending: false });

  // 11. Fetch fulfilment milestones & delivery confirmations for underwritten order (Step 6)
  const { data: poMilestones } = await admin
    .from("fulfilment_milestones")
    .select("id, milestone_name, status, target_date, completed_at")
    .eq("purchase_order_id", po.id)
    .order("created_at", { ascending: true });

  const { data: poConfirmations } = await admin
    .from("delivery_confirmations")
    .select("id, status, delivery_date, quantity_received, received_by_name, condition_notes")
    .eq("purchase_order_id", po.id)
    .order("created_at", { ascending: false });

  const poTotal = Number(po.total_amount);
  const reqAmount = Number(fr.requested_amount);
  const ratio = poTotal > 0 ? ((reqAmount / poTotal) * 100).toFixed(1) : "0.0";

  const canReview = isFinancier || isAdmin;
  const canUploadDocs = isRequester || isSupplierOrg || isAdmin;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={profile?.full_name || user.email}
        userEmail={user.email}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/financing"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Financing Applications
          </Link>

          <span className="font-mono text-xs text-slate-400">
            Dossier #{fr.id.slice(0, 8)}
          </span>
        </div>

        {/* Dossier Top Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Financing Application
                </span>
                <FinancingStatusBadge status={fr.status} size="md" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Coins className="h-7 w-7 text-emerald-700" />
                ₦{reqAmount.toLocaleString()}
              </h1>

              <p className="text-xs text-slate-500">
                Backed by Purchase Order{" "}
                <Link
                  href={`/dashboard/purchase-orders/${po.id}`}
                  className="font-bold text-emerald-800 hover:underline"
                >
                  {po.order_reference}
                </Link>{" "}
                (Contract Value: ₦{poTotal.toLocaleString()})
              </p>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Financing Ratio
                </span>
                <span className="text-lg font-extrabold text-slate-900">
                  {ratio}%
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  PO Items
                </span>
                <span className="text-lg font-extrabold text-slate-900">
                  {items?.length || 0}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Documents
                </span>
                <span className="text-lg font-extrabold text-slate-900">
                  {attachedDocs.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Left (Details & Docs) / Right (Underwriting Desk & Audit) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN: Dossier Details & Documents (2 Cols) */}
          <div className="lg:col-span-2 space-y-8">

            {/* 1. Counterparty & Linked PO Overview Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building className="h-4 w-4 text-emerald-700" />
                  Contract Counterparties
                </h3>
                <Link
                  href={`/dashboard/purchase-orders/${po.id}`}
                  className="text-xs font-bold text-emerald-800 hover:underline"
                >
                  View Full PO &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Buyer (Purchaser)
                  </span>
                  <p className="font-bold text-sm text-slate-900">
                    {buyerOrg?.name || "Corporate Buyer"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {buyerOrg?.address || "Address not provided"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Supplier (Borrower)
                  </span>
                  <p className="font-bold text-sm text-slate-900">
                    {supplierOrg?.name || "Commodity Supplier"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Applicant: {requesterProfile?.full_name || "Representative"}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Financing Purpose & Use of Proceeds */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-700" />
                Financing Purpose & Use of Proceeds
              </h3>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                {fr.purpose}
              </div>
            </div>

            {/* 3. Commodity Line Items Breakdown */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-700" />
                Underlying Agricultural Commodities ({items?.length || 0})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Commodity</th>
                      <th className="px-3 py-2.5">Quantity</th>
                      <th className="px-3 py-2.5 text-right">Unit Price</th>
                      <th className="px-3 py-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {(items || []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2.5 font-bold font-sans text-slate-900">
                          {item.item_name}
                          {item.description && (
                            <span className="block text-[10px] font-normal text-slate-500 font-sans">
                              {item.description}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800">
                          {item.quantity.toLocaleString()} {item.unit}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600">
                          ₦{Number(item.unit_price).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                          ₦{Number(item.line_total).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Fulfilment & Delivery Liquidation Oversight (Step 6) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-700" />
                  Fulfilment & Delivery Settlement Oversight
                </h3>
                <Link
                  href={`/dashboard/purchase-orders/${po.id}`}
                  className="text-xs font-bold text-emerald-800 hover:underline"
                >
                  View Full Timeline &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Milestone Progress
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-700">
                      Logged Milestones: <strong className="text-slate-900">{poMilestones?.length || 0}</strong>
                    </span>
                    <span className="text-xs text-emerald-700 font-semibold">
                      {poMilestones?.filter((m) => m.status === "completed").length || 0} Completed
                    </span>
                  </div>
                  {poMilestones && poMilestones.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {poMilestones.slice(0, 3).map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-xs">
                          <span className="truncate max-w-[180px] text-slate-600 font-medium">
                            {m.milestone_name}
                          </span>
                          <MilestoneStatusBadge status={m.status} size="sm" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No fulfilment milestones recorded yet.</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Buyer Delivery Confirmation
                  </span>
                  {poConfirmations && poConfirmations.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <DeliveryStatusBadge status={poConfirmations[0].status} size="sm" />
                        <span className="text-xs text-slate-500 font-mono">
                          {new Date(poConfirmations[0].delivery_date).toLocaleDateString("en-NG")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">
                        Received by: <strong className="text-slate-900">{poConfirmations[0].received_by_name}</strong>
                        {poConfirmations[0].quantity_received !== null && (
                          <span className="block text-slate-500">
                            Quantity: {Number(poConfirmations[0].quantity_received).toLocaleString()} units
                          </span>
                        )}
                      </p>
                      {poConfirmations[0].status === "confirmed" ? (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="h-3 w-3" />
                          Delivery Verified — Eligible for Trade Settlement
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
                          <AlertTriangle className="h-3 w-3" />
                          Discrepancy Reported — Pending Reconciliation
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 py-1">
                      <p className="text-slate-500">Awaiting commodity delivery to buyer warehouse.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Disbursement settlement requires verified receipt.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5. Document Verification Vault */}
            <DocumentListCard
              purchaseOrderId={po.id}
              documents={attachedDocs}
              userRole={userRole}
              currentUserId={user.id}
            />

          </div>

          {/* RIGHT COLUMN: Institutional Underwriting & Timeline (1 Col) */}
          <div className="space-y-8">

            {/* Underwriting Decision Desk */}
            <FinancingDecisionCard
              requestId={fr.id}
              currentStatus={fr.status}
              requestedAmount={reqAmount}
              poReference={po.order_reference}
              canReview={canReview}
              reviews={reviews}
            />

            {/* Application Audit Trail */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="h-4 w-4 text-slate-700" />
                Immutable Audit Trail ({auditLogs?.length || 0})
              </h3>

              {!auditLogs || auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No audit records logged.</p>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => {
                    const dt = log.details as Record<string, any> | null;
                    return (
                      <div
                        key={log.id}
                        className="relative pl-6 pb-4 border-l-2 border-slate-200 last:border-l-0 last:pb-0"
                      >
                        <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-slate-400" />
                        <div className="space-y-1">
                          <span className="font-mono text-[10px] text-slate-400 block">
                            {new Date(log.created_at).toLocaleString("en-GB")}
                          </span>
                          <p className="text-xs font-bold text-slate-800">
                            {log.action.replace(/_/g, " ")}
                          </p>
                          {dt?.reviewer_name && (
                            <p className="text-[11px] text-slate-600">
                              By: {dt.reviewer_name}
                            </p>
                          )}
                          {dt?.comments && (
                            <p className="text-[11px] text-slate-500 italic">
                              &ldquo;{dt.comments}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
