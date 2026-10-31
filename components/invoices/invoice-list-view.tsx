"use client";

/**
 * HarvestLink Finance - Invoice Overview List View
 *
 * Filterable, searchable table displaying commercial invoices with
 * live metrics, status categories, counterparty details, and links to dossiers.
 */

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Receipt,
  Search,
  PlusCircle,
  Building,
  Calendar,
  Clock,
  ArrowUpRight,
  Filter,
  Coins,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { EnrichedInvoiceRecord, InvoiceStatus } from "@/types/invoice";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { formatCurrencyNGN } from "@/lib/utils";

interface InvoiceListViewProps {
  invoices: EnrichedInvoiceRecord[];
  userRole: string;
  canCreateInvoice: boolean;
}

export function InvoiceListView({
  invoices,
  userRole,
  canCreateInvoice,
}: InvoiceListViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | InvoiceStatus>("all");

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalSettled = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;

    for (const inv of invoices) {
      if (inv.status !== "cancelled") {
        const amt = Number(inv.amount || 0);
        totalInvoiced += amt;

        // Reconciled paid only counts genuine verified settlements (status = 'paid' and !is_simulated)
        const verifiedPaid = (inv.settlements || [])
          .filter((s) => s.status === "paid" && !s.is_simulated)
          .reduce((sum, s) => sum + Number(s.amount), 0);

        if (inv.status === "paid") {
          totalSettled += amt;
        } else if (inv.status === "partially_paid" || verifiedPaid > 0) {
          totalSettled += verifiedPaid;
          totalOutstanding += Math.max(0, amt - verifiedPaid);
        } else {
          totalOutstanding += amt;
        }

        if (inv.status === "overdue") {
          overdueCount++;
        }
      }
    }

    return { totalInvoiced, totalSettled, totalOutstanding, overdueCount };
  }, [invoices]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Tab filter
      if (activeTab !== "all" && inv.status !== activeTab) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const numMatch = inv.invoice_number.toLowerCase().includes(term);
        const poMatch = inv.purchaseOrder?.order_reference?.toLowerCase().includes(term);
        const buyerMatch = inv.purchaseOrder?.buyerOrgName?.toLowerCase().includes(term);
        const supplierMatch = inv.purchaseOrder?.supplierOrgName?.toLowerCase().includes(term);
        return numMatch || poMatch || buyerMatch || supplierMatch;
      }

      return true;
    });
  }, [invoices, activeTab, searchTerm]);

  return (
    <div className="space-y-6">

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Invoiced
            </span>
            <Receipt className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-900">
            {formatCurrencyNGN(metrics.totalInvoiced)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Across {invoices.filter((i) => i.status !== "cancelled").length} active invoices
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Reconciled / Settled
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-extrabold text-emerald-800">
            {formatCurrencyNGN(metrics.totalSettled)}
          </p>
          <span className="text-[11px] text-emerald-600 mt-1 block">
            Settlement tracking records verified
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Outstanding Balance
            </span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-900">
            {formatCurrencyNGN(metrics.totalOutstanding)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Awaiting payment settlement
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Overdue / Flagged
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-extrabold text-rose-700">
            {metrics.overdueCount}
          </p>
          <span className="text-[11px] text-rose-600 mt-1 block">
            Past agreed due date
          </span>
        </div>
      </div>

      {/* Header, Search & Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, PO, or counterparty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Create Button (Suppliers and Admins) */}
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

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
          {[
            { id: "all", label: "All Invoices" },
            { id: "issued", label: "Issued" },
            { id: "paid", label: "Paid" },
            { id: "partially_paid", label: "Partially Paid" },
            { id: "draft", label: "Drafts" },
            { id: "overdue", label: "Overdue" },
            { id: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Data Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {filteredInvoices.length > 0 ? (
          <>
            {/* Mobile Card List (< 640px) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {inv.invoice_number}
                    </span>
                    <InvoiceStatusBadge status={inv.status} size="sm" />
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Receipt className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono font-medium text-emerald-800">
                        {inv.purchaseOrder?.order_reference || `PO #${inv.purchase_order_id.slice(0, 8)}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      To: {inv.purchaseOrder?.buyerOrgName || "Buyer Org"}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                    <span className="text-[11px] text-slate-500">
                      {inv.due_date ? `Due: ${new Date(inv.due_date).toLocaleDateString("en-NG")}` : "Due: Immediate"}
                    </span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm">
                      {formatCurrencyNGN(Number(inv.amount))}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/invoices/${inv.id}`}
                    className="min-h-[44px] w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors"
                  >
                    <span>View Invoice Dossier</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Invoice Reference</th>
                  <th className="px-4 py-3.5">Purchase Order</th>
                  <th className="px-4 py-3.5">Counterparties</th>
                  <th className="px-4 py-3.5 text-right">Amount (₦)</th>
                  <th className="px-4 py-3.5">Issue Date</th>
                  <th className="px-4 py-3.5">Due Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        {inv.invoice_number}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Created {new Date(inv.created_at).toLocaleDateString("en-NG")}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {inv.purchaseOrder ? (
                        <Link
                          href={`/dashboard/purchase-orders/${inv.purchase_order_id}`}
                          className="font-mono font-semibold text-emerald-800 hover:underline"
                        >
                          {inv.purchaseOrder.order_reference}
                        </Link>
                      ) : (
                        <span className="font-mono text-slate-400">
                          #{inv.purchase_order_id.slice(0, 8)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 space-y-0.5">
                      <div className="text-slate-900 font-semibold truncate max-w-[160px]" title={inv.purchaseOrder?.buyerOrgName}>
                        To: {inv.purchaseOrder?.buyerOrgName || "Buyer Org"}
                      </div>
                      <div className="text-slate-500 text-[11px] truncate max-w-[160px]" title={inv.purchaseOrder?.supplierOrgName}>
                        From: {inv.purchaseOrder?.supplierOrgName || "Supplier Org"}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-right font-extrabold text-slate-900 font-mono">
                      {formatCurrencyNGN(Number(inv.amount))}
                    </td>

                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                      {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("en-NG") : "—"}
                    </td>

                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                      {inv.due_date ? (
                        <span className={inv.status === "overdue" ? "text-rose-600 font-bold" : ""}>
                          {new Date(inv.due_date).toLocaleDateString("en-NG")}
                        </span>
                      ) : (
                        <span className="text-slate-400">Immediate</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <InvoiceStatusBadge status={inv.status} size="sm" />
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                      >
                        View Dossier
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
          <div className="p-12 text-center space-y-3">
            <Receipt className="mx-auto h-10 w-10 text-slate-300" />
            <h4 className="text-sm font-bold text-slate-800">
              No commercial invoices found
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || activeTab !== "all"
                ? "No invoices match your selected search criteria or status filter."
                : "No commercial invoices have been issued yet. Invoices can be created against confirmed purchase orders."}
            </p>
            {canCreateInvoice && (
              <div className="pt-2">
                <Link
                  href="/dashboard/invoices/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-900 transition-colors"
                >
                  <PlusCircle className="h-4 w-4" />
                  Create First Invoice
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
