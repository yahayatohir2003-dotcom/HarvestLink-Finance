import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  FileText,
  Clock,
  History,
  CheckCircle2,
  Package,
  Coins,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { PoStatusBadge } from "@/components/purchase-orders/po-status-badge";
import { PoStatusActions } from "@/components/purchase-orders/po-status-actions";
import { DocumentListCard } from "@/components/documents/document-list-card";
import { FinancingStatusBadge } from "@/components/financing/financing-status-badge";
import { FulfilmentTimelineCard } from "@/components/fulfilment/fulfilment-timeline-card";
import { DeliveryConfirmationCard } from "@/components/fulfilment/delivery-confirmation-card";
import { PoInvoicesCard } from "@/components/invoices/po-invoices-card";
import { decodePoDescription } from "@/lib/po-utils";
import { formatCurrencyNGN } from "@/lib/utils";
import { UserRole } from "@/types/auth";
import { PurchaseOrderStatus } from "@/types/purchase-order";
import { DocumentRecord } from "@/types/document";
import { InvoiceRecord } from "@/types/invoice";
import { FinancingRequestStatus } from "@/types/financing";
import {
  EnrichedFulfilmentMilestone,
  EnrichedDeliveryConfirmation,
} from "@/types/fulfilment";

export const dynamic = "force-dynamic";

interface PoDetailPageProps {
  params: {
    id: string;
  };
}

export default async function PurchaseOrderDetailPage({ params }: PoDetailPageProps) {
  const { id: orderId } = params;
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/dashboard/purchase-orders/${orderId}`);
  }

  // 2. Query user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile?.role || user.user_metadata?.role || "buyer") as UserRole;
  const fullName = profile?.full_name || user.user_metadata?.full_name || "Authorized Partner";
  const userEmail = user.email || "";

  // 3. Query purchase order header using administrative client
  const admin = createAdminClient();
  const { data: po, error: poErr } = await admin
    .from("purchase_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (poErr || !po) {
    notFound();
  }

  // 4. Access restriction: Verify user belongs to either the Buyer, Supplier, or is Admin/Financier
  const isBuyer = profile?.organization_id === po.buyer_organization_id;
  const isSupplier = profile?.organization_id === po.supplier_organization_id;
  const isAdmin = userRole === "admin";
  const isFinancier = userRole === "financier";

  if (!isBuyer && !isSupplier && !isAdmin && !isFinancier) {
    redirect("/dashboard/purchase-orders");
  }

  // 5. Query counterparty organisations
  const { data: buyerOrg } = await admin
    .from("organizations")
    .select("id, name, registration_number, address, phone, email")
    .eq("id", po.buyer_organization_id)
    .maybeSingle();

  let supplierOrg: { id: string; name: string; registration_number: string | null; address: string | null; phone: string | null; email: string | null } | null = null;
  if (po.supplier_organization_id) {
    const { data: sOrg } = await admin
      .from("organizations")
      .select("id, name, registration_number, address, phone, email")
      .eq("id", po.supplier_organization_id)
      .maybeSingle();
    supplierOrg = sOrg;
  }

  // 6. Query order line items
  const { data: items } = await admin
    .from("order_items")
    .select("*")
    .eq("purchase_order_id", orderId)
    .order("created_at", { ascending: true });

  // 7. Query attached documents from 'documents' table
  const { data: rawDocs } = await admin
    .from("documents")
    .select("*")
    .eq("purchase_order_id", orderId)
    .order("created_at", { ascending: false });

  // Fetch uploader names for documents
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
    uploaderName: uploaderMap[d.uploaded_by] || "Partner Representative",
  }));

  // 8. Query audit trail logs for this purchase order
  const { data: auditLogs } = await admin
    .from("audit_logs")
    .select("id, actor_id, action, details, created_at")
    .eq("entity_table", "purchase_orders")
    .eq("entity_id", orderId)
    .order("created_at", { ascending: false });

  // Also query document audit logs for attached documents
  const docIds = (rawDocs || []).map((d) => d.id);
  let docAuditLogs: Array<{ id: string; actor_id: string | null; action: string; details: unknown; created_at: string }> = [];
  if (docIds.length > 0) {
    const { data: dLogs } = await admin
      .from("audit_logs")
      .select("id, actor_id, action, details, created_at")
      .eq("entity_table", "documents")
      .in("entity_id", docIds)
      .order("created_at", { ascending: false });
    if (dLogs) docAuditLogs = dLogs;
  }

  // 9. Decode delivery address and notes from description
  const decoded = decodePoDescription(po.description);

  // User's own organisation name for header
  let currentOrgName = user.user_metadata?.organisation_name || "Agribusiness Partner";
  if (profile?.organization_id) {
    const { data: currentOrg } = await admin
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (currentOrg?.name) currentOrgName = currentOrg.name;
  }

  // 10. Query active financing request linked to this purchase order
  const { data: financingRequest } = await admin
    .from("financing_requests")
    .select("id, requested_amount, status, purpose")
    .eq("purchase_order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 11. Query fulfilment milestones (Step 6)
  const { data: rawMilestones } = await admin
    .from("fulfilment_milestones")
    .select("*")
    .eq("purchase_order_id", orderId)
    .order("created_at", { ascending: true });

  const milestoneRecorderIds = Array.from(
    new Set((rawMilestones || []).map((m) => m.recorded_by).filter(Boolean))
  );
  let milestoneRecorderMap: Record<string, any> = {};
  if (milestoneRecorderIds.length > 0) {
    const { data: recProfiles } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .in("id", milestoneRecorderIds);
    if (recProfiles) {
      milestoneRecorderMap = Object.fromEntries(recProfiles.map((p) => [p.id, p]));
    }
  }

  const milestones: EnrichedFulfilmentMilestone[] = (rawMilestones || []).map((m) => ({
    ...m,
    recorderProfile: m.recorded_by ? milestoneRecorderMap[m.recorded_by] : null,
  }));

  // 12. Query delivery confirmations (Step 6)
  const { data: rawConfirmations } = await admin
    .from("delivery_confirmations")
    .select("*")
    .eq("purchase_order_id", orderId)
    .order("created_at", { ascending: false });

  const confirmerIds = Array.from(
    new Set((rawConfirmations || []).map((c) => c.confirmed_by).filter(Boolean))
  );
  let confirmerMap: Record<string, any> = {};
  if (confirmerIds.length > 0) {
    const { data: confProfiles } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .in("id", confirmerIds);
    if (confProfiles) {
      confirmerMap = Object.fromEntries(confProfiles.map((p) => [p.id, p]));
    }
  }

  const confirmations: EnrichedDeliveryConfirmation[] = (rawConfirmations || []).map((c) => ({
    ...c,
    confirmerProfile: confirmerMap[c.confirmed_by] || null,
    evidenceDocument: (rawDocs || []).find((d) => d.id === c.evidence_document_id) || null,
  }));

  // 13. Query milestone & confirmation audit logs
  const milestoneIds = (rawMilestones || []).map((m) => m.id);
  const confirmationIds = (rawConfirmations || []).map((c) => c.id);

  let milestoneAuditLogs: Array<{ id: string; actor_id: string | null; action: string; details: unknown; created_at: string }> = [];
  if (milestoneIds.length > 0) {
    const { data: mLogs } = await admin
      .from("audit_logs")
      .select("id, actor_id, action, details, created_at")
      .eq("entity_table", "fulfilment_milestones")
      .in("entity_id", milestoneIds);
    if (mLogs) milestoneAuditLogs = mLogs;
  }

  let confirmationAuditLogs: Array<{ id: string; actor_id: string | null; action: string; details: unknown; created_at: string }> = [];
  if (confirmationIds.length > 0) {
    const { data: cLogs } = await admin
      .from("audit_logs")
      .select("id, actor_id, action, details, created_at")
      .eq("entity_table", "delivery_confirmations")
      .in("entity_id", confirmationIds);
    if (cLogs) confirmationAuditLogs = cLogs;
  }

  // 14. Query commercial invoices for this purchase order (Step 7)
  const { data: poInvoices } = await admin
    .from("invoices")
    .select("*")
    .eq("purchase_order_id", orderId)
    .order("created_at", { ascending: false });

  const invoiceIds = (poInvoices || []).map((i) => i.id);
  let invoiceAuditLogs: Array<{ id: string; actor_id: string | null; action: string; details: unknown; created_at: string }> = [];
  if (invoiceIds.length > 0) {
    const { data: iLogs } = await admin
      .from("audit_logs")
      .select("id, actor_id, action, details, created_at")
      .eq("entity_table", "invoices")
      .in("entity_id", invoiceIds);
    if (iLogs) invoiceAuditLogs = iLogs;
  }

  // Combine and sort PO, Document, Milestone, Confirmation, and Invoice audit trails
  const combinedAuditLogs = [
    ...(auditLogs || []),
    ...docAuditLogs,
    ...milestoneAuditLogs,
    ...confirmationAuditLogs,
    ...invoiceAuditLogs,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Total quantity for delivery confirmation comparison
  const totalOrderedQuantity = (items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const canManageMilestones = isSupplier || isAdmin;
  const canConfirmDelivery = isBuyer || isAdmin;
  const canCreateInvoice = isSupplier || isAdmin;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={fullName}
        organisationName={currentOrgName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              href="/dashboard/purchase-orders"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Purchase Orders
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {po.order_reference}
              </h1>
              <PoStatusBadge status={po.status} size="lg" />
            </div>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Created on {new Date(po.created_at).toLocaleString("en-NG")}
            </p>
          </div>

          {/* Workflow Action Buttons */}
          <PoStatusActions
            orderId={po.id}
            orderReference={po.order_reference}
            currentStatus={po.status as PurchaseOrderStatus}
            userRole={userRole}
            isBuyer={isBuyer}
            isSupplier={isSupplier}
          />
        </div>

        {/* PO Financing Coordination Strip */}
        {financingRequest ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">
                    PO Financing Application Active
                  </span>
                  <FinancingStatusBadge
                    status={financingRequest.status as FinancingRequestStatus}
                    size="sm"
                  />
                </div>
                {userRole !== "buyer" ? (
                  <p className="text-slate-600 text-xs mt-0.5">
                    Requested: <span className="font-bold text-slate-900">₦{Number(financingRequest.requested_amount).toLocaleString()}</span> • Dossier #{financingRequest.id.slice(0, 8)}
                  </p>
                ) : (
                  <p className="text-slate-600 text-xs mt-0.5">
                    Supplier Facility Status: <span className="font-bold text-slate-900 capitalize">{financingRequest.status.replace(/_/g, " ")}</span>
                  </p>
                )}
              </div>
            </div>

            {userRole !== "buyer" && (
              <Link
                href={`/dashboard/financing/${financingRequest.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-800 transition-colors shrink-0"
              >
                <span>View Financing Dossier</span>
                <ArrowLeft className="h-3 w-3 rotate-180" />
              </Link>
            )}
          </div>
        ) : (isSupplier || isAdmin) && (po.status === "submitted" || po.status === "accepted") ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm shrink-0">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">
                  Eligible for Purchase Order Financing
                </p>
                <p className="text-slate-600 text-xs mt-0.5">
                  Apply for working capital against this confirmed order to procure and aggregate produce.
                </p>
              </div>
            </div>

            <Link
              href={`/dashboard/financing/new?po=${po.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800 transition-colors shrink-0"
            >
              <Coins className="h-3.5 w-3.5" />
              <span>Apply for PO Financing</span>
            </Link>
          </div>
        ) : null}

        {/* Counterparties Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Buyer Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Issuing Corporate Buyer
              </span>
              <Building2 className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{buyerOrg?.name || "Corporate Buyer"}</h3>
              {buyerOrg?.registration_number && (
                <p className="text-xs text-slate-500">RC Number: {buyerOrg.registration_number}</p>
              )}
            </div>
            <div className="space-y-1 text-xs text-slate-600">
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {buyerOrg?.address || "Address not provided"}
              </p>
              <p>Email: {buyerOrg?.email || "N/A"}</p>
              <p>Phone: {buyerOrg?.phone || "N/A"}</p>
            </div>
          </div>

          {/* Supplier Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Designated Produce Supplier
              </span>
              <Building2 className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{supplierOrg?.name || "Unassigned Supplier"}</h3>
              {supplierOrg?.registration_number && (
                <p className="text-xs text-slate-500">RC Number: {supplierOrg.registration_number}</p>
              )}
            </div>
            <div className="space-y-1 text-xs text-slate-600">
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {supplierOrg?.address || "Address not provided"}
              </p>
              <p>Email: {supplierOrg?.email || "N/A"}</p>
              <p>Phone: {supplierOrg?.phone || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Delivery & Commercial Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="h-4 w-4 text-amber-700" />
            Delivery Benchmarks & Logistics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Issue Date</span>
              <p className="mt-1 font-semibold text-slate-900">{po.order_date}</p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Expected Delivery Date</span>
              <p className="mt-1 font-semibold text-slate-900">
                {po.expected_delivery_date || "Open / Unspecified"}
              </p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Designated Warehouse</span>
              <p className="mt-1 text-xs text-slate-800 leading-relaxed">{decoded.deliveryAddress}</p>
            </div>
          </div>

          {decoded.notes && (
            <div className="pt-3 border-t border-slate-100">
              <span className="block text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Special Quality Specifications & Instructions
              </span>
              <p className="mt-1 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {decoded.notes}
              </p>
            </div>
          )}
        </div>

        {/* Product Line Items */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-700" />
                Contracted Produce & Commodities
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed breakdown of agricultural line items and negotiated unit pricing.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {items?.length || 0} line items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Commodity / Item Name</th>
                  <th className="px-4 py-3">Specifications</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Unit Price (₦)</th>
                  <th className="px-4 py-3 text-right">Line Total (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items?.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{item.item_name}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 max-w-xs">{item.description || "—"}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-800">
                      {Number(item.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-600">{item.unit}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-slate-800">
                      {formatCurrencyNGN(Number(item.unit_price))}
                    </td>
                    <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                      {formatCurrencyNGN(Number(item.line_total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grand Total Bar */}
          <div className="mt-6 rounded-xl bg-slate-900 p-6 text-white flex justify-between items-center shadow-md">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Total Contract Settlement
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                Currency: Nigerian Naira (NGN - ₦)
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {formatCurrencyNGN(Number(po.total_amount))}
              </span>
            </div>
          </div>
        </div>

        {/* Fulfilment Milestones Tracking (Step 6) */}
        <FulfilmentTimelineCard
          purchaseOrderId={po.id}
          orderReference={po.order_reference}
          orderStatus={po.status}
          milestones={milestones}
          canManageMilestones={canManageMilestones}
        />

        {/* Delivery Confirmation Desk (Step 6) */}
        <DeliveryConfirmationCard
          purchaseOrderId={po.id}
          orderReference={po.order_reference}
          orderStatus={po.status}
          totalOrderedQuantity={totalOrderedQuantity}
          confirmations={confirmations}
          availableDocuments={attachedDocs}
          canConfirmDelivery={canConfirmDelivery}
        />

        {/* Commercial Invoices (Step 7) */}
        <PoInvoicesCard
          purchaseOrderId={po.id}
          orderReference={po.order_reference}
          orderStatus={po.status}
          invoices={(poInvoices || []) as InvoiceRecord[]}
          canCreateInvoice={canCreateInvoice}
        />

        {/* Attached Trade Documents (Step 4) */}
        <DocumentListCard
          purchaseOrderId={po.id}
          documents={attachedDocs}
          userRole={userRole}
          currentUserId={user.id}
        />

        {/* Audit Trail History */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              Verified Audit Trail
            </h3>
            <span className="text-xs text-slate-500">Immutable ledger records from audit_logs</span>
          </div>

          {combinedAuditLogs && combinedAuditLogs.length > 0 ? (
            <div className="space-y-3">
              {combinedAuditLogs.map((log) => {
                const details = log.details as Record<string, unknown>;
                return (
                  <div
                    key={log.id}
                    className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-bold text-slate-900 font-mono">{log.action}</span>
                      </div>
                      <p className="text-slate-600">
                        {log.action === "PURCHASE_ORDER_STATUS_CHANGED" && (
                          <span>
                            Status shifted from <span className="font-semibold">{String(details?.previous_status)}</span> to{" "}
                            <span className="font-semibold">{String(details?.new_status)}</span>
                            {Boolean(details?.reason) && ` (Reason: ${String(details?.reason)})`}
                          </span>
                        )}
                        {log.action === "PURCHASE_ORDER_CREATED" && (
                          <span>
                            Order initialized with {String(details?.items_count)} commodities totaling{" "}
                            {formatCurrencyNGN(Number(details?.total_amount) || 0)}
                          </span>
                        )}
                        {log.action === "PURCHASE_ORDER_UPDATED" && (
                          <span>
                            Updated line items and contract value to {formatCurrencyNGN(Number(details?.new_total_amount) || 0)}
                          </span>
                        )}
                        {log.action === "DOCUMENT_UPLOADED" && (
                          <span>
                            Document <span className="font-semibold">{String(details?.original_filename)}</span> (
                            {String(details?.document_type)}) attached to transaction.
                          </span>
                        )}
                        {log.action === "DOCUMENT_VERIFIED" && (
                          <span>
                            Document <span className="font-semibold">{String(details?.original_filename)}</span> verified by{" "}
                            {String(details?.reviewed_by || "Reviewer")}.
                          </span>
                        )}
                        {log.action === "DOCUMENT_REJECTED" && (
                          <span>
                            Document <span className="font-semibold">{String(details?.original_filename)}</span> rejected.
                            {Boolean(details?.reason) && ` Reason: ${String(details?.reason)}`}
                          </span>
                        )}
                        {log.action === "DOCUMENT_DELETED" && (
                          <span>
                            Document <span className="font-semibold">{String(details?.original_filename)}</span> removed.
                          </span>
                        )}
                        {log.action === "FULFILMENT_MILESTONE_CREATED" && (
                          <span>
                            Milestone <span className="font-semibold">{String(details?.milestone_name)}</span> logged with status{" "}
                            <span className="font-semibold">{String(details?.status)}</span>
                            {Boolean(details?.target_date) && ` (Target: ${new Date(String(details?.target_date)).toLocaleDateString("en-NG")})`}
                          </span>
                        )}
                        {log.action === "FULFILMENT_MILESTONE_UPDATED" && (
                          <span>
                            Milestone <span className="font-semibold">{String(details?.milestone_name)}</span> status changed from{" "}
                            <span className="font-semibold">{String(details?.previous_status)}</span> to{" "}
                            <span className="font-semibold">{String(details?.new_status)}</span>.
                          </span>
                        )}
                        {log.action === "DELIVERY_CONFIRMED" && (
                          <span>
                            Delivery officially confirmed by <span className="font-semibold">{String(details?.received_by_name)}</span>
                            {Boolean(details?.quantity_received) && ` (${Number(details?.quantity_received).toLocaleString()} units received)`}.
                          </span>
                        )}
                        {log.action === "DELIVERY_DISPUTED" && (
                          <span>
                            Delivery discrepancy / dispute filed by <span className="font-semibold">{String(details?.received_by_name)}</span>.
                            {Boolean(details?.condition_notes) && ` Notes: ${String(details?.condition_notes)}`}
                          </span>
                        )}
                        {log.action === "ORDER_FULFILLED" && (
                          <span>
                            Order status marked as <span className="font-semibold text-emerald-700">FULFILLED</span> following verified delivery receipt.
                          </span>
                        )}
                        {log.action === "INVOICE_CREATED" && (
                          <span>
                            Commercial invoice <span className="font-semibold font-mono">{String(details?.invoice_number)}</span> issued for{" "}
                            {formatCurrencyNGN(Number(details?.amount) || 0)} ({String(details?.status)}).
                          </span>
                        )}
                        {log.action === "INVOICE_STATUS_UPDATED" && (
                          <span>
                            Invoice <span className="font-semibold font-mono">{String(details?.invoice_number)}</span> status changed from{" "}
                            <span className="font-semibold">{String(details?.previous_status)}</span> to{" "}
                            <span className="font-semibold">{String(details?.new_status)}</span>.
                            {Boolean(details?.reason) && ` (Reason: ${String(details?.reason)})`}
                          </span>
                        )}
                        {log.action === "SETTLEMENT_RECORDED" && (
                          <span>
                            Settlement record logged for {formatCurrencyNGN(Number(details?.amount) || 0)} (
                            Status: <span className="font-semibold">{String(details?.status)}</span>
                            {Boolean(details?.is_simulated) && ", Simulated"}
                            ).
                          </span>
                        )}
                        {log.action === "SETTLEMENT_RECONCILED" && (
                          <span>
                            Settlement of {formatCurrencyNGN(Number(details?.amount) || 0)} <span className="font-semibold text-emerald-700">VERIFIED & RECONCILED</span> by {String(details?.reviewed_by || "Reviewer")}.
                          </span>
                        )}
                        {log.action === "SETTLEMENT_REJECTED" && (
                          <span>
                            Settlement claim of {formatCurrencyNGN(Number(details?.amount) || 0)} <span className="font-semibold text-rose-700">REJECTED</span>.
                            {Boolean(details?.reason) && ` Reason: ${String(details?.reason)}`}
                          </span>
                        )}
                      </p>
                    </div>

                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("en-NG")}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-2">
              No historical status changes recorded yet.
            </p>
          )}
        </div>

      </main>
    </div>
  );
}
