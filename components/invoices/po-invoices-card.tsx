import React from "react";
import Link from "next/link";
import { Receipt, PlusCircle, ArrowUpRight, FileText } from "lucide-react";
import { InvoiceRecord } from "@/types/invoice";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { formatCurrencyNGN } from "@/lib/utils";

interface PoInvoicesCardProps {
  purchaseOrderId: string;
  orderReference: string;
  orderStatus: string;
  invoices: InvoiceRecord[];
  canCreateInvoice: boolean;
}

export function PoInvoicesCard({
  purchaseOrderId,
  orderReference,
  orderStatus,
  invoices,
  canCreateInvoice,
}: PoInvoicesCardProps) {
  const eligibleForInvoice = orderStatus === "accepted" || orderStatus === "fulfilled";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-700" />
            Commercial Invoices ({invoices.length})
          </h3>
          <p className="text-xs text-slate-500">
            Payment requests and settlement tracking for this contract
          </p>
        </div>

        {canCreateInvoice && eligibleForInvoice && (
          <Link
            href={`/dashboard/invoices/new?poId=${purchaseOrderId}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-900 transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Issue Invoice
          </Link>
        )}
      </div>

      {invoices.length > 0 ? (
        <div className="space-y-2.5">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 hover:bg-slate-50 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {inv.invoice_number}
                  </span>
                  <InvoiceStatusBadge status={inv.status} size="sm" />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span>Issued: {new Date(inv.issue_date).toLocaleDateString("en-NG")}</span>
                  {inv.due_date && <span>• Due: {new Date(inv.due_date).toLocaleDateString("en-NG")}</span>}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 text-sm font-mono block">
                    {formatCurrencyNGN(Number(inv.amount))}
                  </span>
                  <span className="text-[10px] text-slate-400">Total Due</span>
                </div>

                <Link
                  href={`/dashboard/invoices/${inv.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                >
                  View
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-slate-500 italic">
          <p>No commercial invoices have been issued for this purchase order yet.</p>
          {canCreateInvoice && eligibleForInvoice && (
            <p className="mt-1 text-emerald-800 not-italic font-semibold">
              Click &quot;Issue Invoice&quot; to generate an official commercial invoice.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
