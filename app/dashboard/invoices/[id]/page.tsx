import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Receipt,
  Building,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  CreditCard,
  FileCheck2,
  Coins,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { InvoiceStatusActions } from "@/components/invoices/invoice-status-actions";
import { SettlementReconciliationCard } from "@/components/invoices/settlement-reconciliation-card";
import { DocumentListCard } from "@/components/documents/document-list-card";
import { formatCurrencyNGN } from "@/lib/utils";
import { UserRole } from "@/types/auth";
import {
  InvoiceStatus,
  SettlementRecord,
  calculateInvoiceReconciliation,
} from "@/types/invoice";
import { DocumentRecord } from "@/types/document";

export const dynamic = "force-dynamic";

interface InvoiceDetailPageProps {
  params: {
    id: string;
  };
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const invoiceId = params.id;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/dashboard/invoices/${invoiceId}`);
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

  // 2. Fetch invoice record
  const { data: invoice, error: invErr } = await admin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr || !invoice) {
    notFound();
  }

  // 3. Fetch linked purchase order
  const { data: po } = await admin
    .from("purchase_orders")
    .select("id, order_reference, total_amount, status, created_at, buyer_organization_id, supplier_organization_id")
    .eq("id", invoice.purchase_order_id)
    .maybeSingle();

  if (!po) {
    notFound();
  }

  // 4. Access Authorization Guard:
  // Must belong to Buyer org, Supplier org, or be Admin/Financier
  const isBuyer = profile?.organization_id === po.buyer_organization_id;
  const isSupplier = profile?.organization_id === po.supplier_organization_id;
  const isAdmin = userRole === "admin";
  const isFinancier = userRole === "financier";

  if (!isBuyer && !isSupplier && !isAdmin && !isFinancier) {
    redirect("/dashboard/invoices");
  }

  // 5. Fetch Counterparties
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

  // 6. Fetch PO commodity line items
  const { data: items } = await admin
    .from("order_items")
    .select("*")
    .eq("purchase_order_id", po.id)
    .order("created_at", { ascending: true });

  // 7. Fetch non-custodial settlement tracking records
  const { data: settlements } = await admin
    .from("settlements")
    .select("*")
    .or(`invoice_id.eq.${invoice.id},purchase_order_id.eq.${po.id}`)
    .order("created_at", { ascending: false });

  // 8. Fetch attached documents for this PO / invoice
  const { data: rawDocs } = await admin
    .from("documents")
    .select("*")
    .eq("purchase_order_id", po.id)
    .order("created_at", { ascending: false });

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

  // 9. Fetch audit logs for this invoice and linked settlements
  const settlementIds = (settlements || []).map((s) => s.id);
  const { data: invoiceAuditLogs } = await admin
    .from("audit_logs")
    .select("id, actor_id, action, details, created_at")
    .eq("entity_table", "invoices")
    .eq("entity_id", invoice.id)
    .order("created_at", { ascending: false });

  let settlementAuditLogs: Array<{ id: string; actor_id: string | null; action: string; details: unknown; created_at: string }> = [];
  if (settlementIds.length > 0) {
    const { data: sLogs } = await admin
      .from("audit_logs")
      .select("id, actor_id, action, details, created_at")
      .eq("entity_table", "settlements")
      .in("entity_id", settlementIds);
    if (sLogs) settlementAuditLogs = sLogs;
  }

  const combinedAuditLogs = [
    ...(invoiceAuditLogs || []),
    ...settlementAuditLogs,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const invoiceAmount = Number(invoice.amount);
  const poTotal = Number(po.total_amount);
  const typedSettlements = (settlements || []) as SettlementRecord[];
  const reconciliation = calculateInvoiceReconciliation(
    invoiceAmount,
    invoice.status as InvoiceStatus,
    typedSettlements
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={fullName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Invoices
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {invoice.invoice_number}
              </h1>
              <InvoiceStatusBadge status={invoice.status} size="lg" />
            </div>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Issued on {new Date(invoice.issue_date).toLocaleDateString("en-NG")}
              {invoice.due_date && (
                <span>• Due by {new Date(invoice.due_date).toLocaleDateString("en-NG")}</span>
              )}
            </p>
          </div>

          {/* Workflow Action Buttons */}
          <InvoiceStatusActions
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            invoiceAmount={invoiceAmount}
            currentStatus={invoice.status as InvoiceStatus}
            purchaseOrderId={po.id}
            orderReference={po.order_reference}
            userRole={userRole}
            isSupplier={isSupplier}
            isBuyer={isBuyer}
            remainingBalance={reconciliation.remainingBalance}
          />
        </div>

        {/* Top Summary Value Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Invoiced Demand
            </span>
            <div className="text-3xl font-extrabold text-slate-900 font-mono">
              {formatCurrencyNGN(invoiceAmount)}
            </div>
            <p className="text-xs text-slate-500">
              Contract Balance Backed by PO{" "}
              <Link
                href={`/dashboard/purchase-orders/${po.id}`}
                className="font-mono font-bold text-emerald-800 hover:underline"
              >
                {po.order_reference}
              </Link>{" "}
              ({formatCurrencyNGN(poTotal)})
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full sm:w-auto">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center min-w-[120px]">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Reconciled Paid
              </span>
              <span className="text-xs font-bold text-emerald-700 font-mono">
                {formatCurrencyNGN(reconciliation.reconciledPaid)}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center min-w-[120px]">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Remaining Balance
              </span>
              <span className="text-xs font-bold text-slate-900 font-mono">
                {formatCurrencyNGN(reconciliation.remainingBalance)}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center min-w-[120px] col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Settlements Logged
              </span>
              <span className="text-xs font-bold text-slate-900 font-mono">
                {settlements?.length || 0} Records
              </span>
            </div>
          </div>
        </div>

        {/* Main Grid: Left (Contract Details & Line Items) / Right (Settlement Ledger & Audit) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN: 2 Cols */}
          <div className="lg:col-span-2 space-y-8">

            {/* 1. Counterparty Overview */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building className="h-4 w-4 text-emerald-700" />
                Commercial Counterparties
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Billed To (Buyer)
                  </span>
                  <p className="font-bold text-sm text-slate-900">
                    {buyerOrg?.name || "Corporate Buyer"}
                  </p>
                  <p className="text-slate-500">
                    {buyerOrg?.address || "Address not provided"}
                  </p>
                  {buyerOrg?.email && (
                    <p className="text-slate-500">Email: {buyerOrg.email}</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Payable To (Supplier)
                  </span>
                  <p className="font-bold text-sm text-slate-900">
                    {supplierOrg?.name || "Commodity Supplier"}
                  </p>
                  <p className="text-slate-500">
                    {supplierOrg?.address || "Address not provided"}
                  </p>
                  {supplierOrg?.email && (
                    <p className="text-slate-500">Email: {supplierOrg.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Commodity Line Items Breakdown */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-700" />
                  Contracted Agricultural Commodities ({items?.length || 0})
                </h3>
                <Link
                  href={`/dashboard/purchase-orders/${po.id}`}
                  className="text-xs font-bold text-emerald-800 hover:underline"
                >
                  View Full Order &rarr;
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Item</th>
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
                          {formatCurrencyNGN(Number(item.unit_price))}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                          {formatCurrencyNGN(Number(item.line_total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Non-Custodial Settlement Reconciliation Ledger (Step 8) */}
            <SettlementReconciliationCard
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              invoiceAmount={invoiceAmount}
              invoiceStatus={invoice.status as InvoiceStatus}
              settlements={typedSettlements}
              userRole={userRole}
            />

            {/* 4. Supporting Trade Documents Vault */}
            <DocumentListCard
              purchaseOrderId={po.id}
              documents={attachedDocs}
              userRole={userRole}
              currentUserId={user.id}
            />

          </div>

          {/* RIGHT COLUMN: 1 Col */}
          <div className="space-y-6">

            {/* Payment Due Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                Settlement Details
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Invoice Status
                  </span>
                  <div className="mt-1">
                    <InvoiceStatusBadge status={invoice.status} size="md" />
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Issue Date
                  </span>
                  <span className="font-bold text-slate-800">
                    {new Date(invoice.issue_date).toLocaleDateString("en-NG")}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Payment Due Date
                  </span>
                  <span className={`font-bold ${invoice.status === "overdue" ? "text-rose-600" : "text-slate-800"}`}>
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-NG") : "Immediate / On Delivery"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Invoice UUID
                  </span>
                  <span className="font-mono text-slate-400 text-[11px] break-all">
                    {invoice.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Non-Custodial Platform Scope Notice */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 space-y-2 text-xs text-amber-900">
              <span className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Coordination Boundary
              </span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                HarvestLink coordinates document and trade settlement data. The platform does not hold funds, initiate direct bank debits, or collect payment card PINs. Real settlement is executed directly between buyer and supplier banking accounts.
              </p>
            </div>

            {/* Immutable Audit Trail */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  Verified Audit Trail
                </h3>
              </div>

              {combinedAuditLogs && combinedAuditLogs.length > 0 ? (
                <div className="space-y-3">
                  {combinedAuditLogs.map((log) => {
                    const details = log.details as Record<string, unknown>;
                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 font-mono text-[11px]">
                            {log.action}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(log.created_at).toLocaleDateString("en-NG")}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">
                          {log.action === "INVOICE_CREATED" && (
                            <span>
                              Invoice <span className="font-semibold">{String(details?.invoice_number)}</span> created for{" "}
                              {formatCurrencyNGN(Number(details?.amount) || 0)}.
                            </span>
                          )}
                          {log.action === "INVOICE_STATUS_UPDATED" && (
                            <span>
                              Status shifted from <span className="font-semibold">{String(details?.previous_status)}</span> to{" "}
                              <span className="font-semibold">{String(details?.new_status)}</span>.
                            </span>
                          )}
                          {log.action === "SETTLEMENT_RECORDED" && (
                            <span>
                              Settlement logged for {formatCurrencyNGN(Number(details?.amount) || 0)} ({String(details?.status)}).
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No audit records yet.</p>
              )}
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
