"use client";

/**
 * HarvestLink Finance - Commercial Invoice Creation Form
 *
 * Enables agricultural suppliers and administrators to issue invoices
 * against confirmed purchase orders with automated amount validation,
 * counterparty pre-filling, and unique reference generation.
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Receipt,
  Building,
  Calendar,
  AlertCircle,
  Loader2,
  FileCheck2,
  Send,
  Save,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { createInvoiceAction } from "@/app/dashboard/invoices/actions";
import { generateInvoiceReference } from "@/types/invoice";
import { formatCurrencyNGN } from "@/lib/utils";

interface EligiblePurchaseOrder {
  id: string;
  order_reference: string;
  total_amount: number;
  status: string;
  created_at: string;
  buyer_organization_id: string;
  supplier_organization_id: string;
  buyerName: string;
  existingInvoicesCount: number;
}

interface InvoiceFormProps {
  eligibleOrders: EligiblePurchaseOrder[];
  preselectedPoId?: string;
}

export function InvoiceForm({
  eligibleOrders,
  preselectedPoId,
}: InvoiceFormProps) {
  const router = useRouter();

  // Selected purchase order
  const [selectedPoId, setSelectedPoId] = useState<string>(preselectedPoId || "");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize defaults
  useEffect(() => {
    setInvoiceNumber(generateInvoiceReference());
    const today = new Date().toISOString().split("T")[0];
    setIssueDate(today);

    // Default due date to 14 days later
    const dDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    setDueDate(dDate);
  }, []);

  // Update amount when a PO is selected
  useEffect(() => {
    if (selectedPoId) {
      const found = eligibleOrders.find((o) => o.id === selectedPoId);
      if (found) {
        setAmount(String(found.total_amount));
      }
    }
  }, [selectedPoId, eligibleOrders]);

  const selectedPo = eligibleOrders.find((o) => o.id === selectedPoId);

  const handleSubmit = async (targetStatus: "draft" | "issued") => {
    setError(null);

    if (!selectedPoId) {
      setError("Please select a confirmed purchase order.");
      return;
    }

    if (!invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Invoice amount must be a positive number greater than zero.");
      return;
    }

    if (selectedPo && numAmount > Number(selectedPo.total_amount)) {
      setError(
        `Invoice amount (₦${numAmount.toLocaleString()}) cannot exceed the purchase order contract total (₦${Number(selectedPo.total_amount).toLocaleString()}).`
      );
      return;
    }

    if (dueDate && new Date(dueDate) < new Date(issueDate)) {
      setError("Payment due date cannot precede the invoice issue date.");
      return;
    }

    setLoading(true);

    try {
      const res = await createInvoiceAction({
        purchase_order_id: selectedPoId,
        invoice_number: invoiceNumber.trim(),
        amount: numAmount,
        issue_date: issueDate || undefined,
        due_date: dueDate || null,
        status: targetStatus,
      });

      if (!res.success) {
        setError(res.message);
      } else {
        router.push(res.data?.invoiceId ? `/dashboard/invoices/${res.data.invoiceId}` : "/dashboard/invoices");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create invoice.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const regenerateNumber = () => {
    setInvoiceNumber(generateInvoiceReference());
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2 shadow-sm">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Validation Error:</span> {error}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Form Fields (2 Columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-700" />
              Invoice Information
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Strict 8-Column Schema
            </span>
          </div>

          <div className="space-y-4">
            {/* Purchase Order Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Target Purchase Order *
              </label>
              {eligibleOrders.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  <p className="font-bold">No eligible purchase orders available.</p>
                  <p className="mt-1 text-slate-600">
                    Commercial invoices can only be issued against confirmed (`accepted` or `fulfilled`) purchase orders.
                  </p>
                  <Link
                    href="/dashboard/purchase-orders"
                    className="inline-block mt-2 font-bold text-emerald-800 hover:underline"
                  >
                    View Purchase Orders &rarr;
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  <option value="">-- Select a Confirmed Purchase Order --</option>
                  {eligibleOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.order_reference} — {po.buyerName} ({formatCurrencyNGN(po.total_amount)}) [{po.status.toUpperCase()}]
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Invoice Reference Number */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Invoice Number / Reference *
                </label>
                <button
                  type="button"
                  onClick={regenerateNumber}
                  className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate Reference
                </button>
              </div>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. HL-INV-20261031-4921"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Must be globally unique. Enforced by database constraint invoices_invoice_number_key.
              </span>
            </div>

            {/* Invoice Amount */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Invoice Total Amount (₦ NGN) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  ₦
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 pl-8 pr-3.5 py-2.5 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
              {selectedPo && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Contract Value: {formatCurrencyNGN(Number(selectedPo.total_amount))}</span>
                  <button
                    type="button"
                    onClick={() => setAmount(String(selectedPo.total_amount))}
                    className="font-bold text-emerald-800 hover:underline"
                  >
                    Set Full Value
                  </button>
                </div>
              )}
            </div>

            {/* Issue Date & Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Issue Date *
                </label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link
              href="/dashboard/invoices"
              className="w-full sm:w-auto text-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>

            <button
              type="button"
              disabled={loading || !selectedPoId}
              onClick={() => handleSubmit("draft")}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save as Draft
            </button>

            <button
              type="button"
              disabled={loading || !selectedPoId}
              onClick={() => handleSubmit("issued")}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-900 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Issue Commercial Invoice
            </button>
          </div>
        </div>

        {/* Sidebar Summary Card (1 Column) */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              Contract Summary
            </h3>

            {selectedPo ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Order Reference
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {selectedPo.order_reference}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Buyer Organization
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedPo.buyerName}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Contract Total
                  </span>
                  <span className="font-bold text-slate-900 text-base">
                    {formatCurrencyNGN(Number(selectedPo.total_amount))}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Existing Invoices on Order
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedPo.existingInvoicesCount} invoices on file
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Select a confirmed purchase order to preview contract details.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-2 text-xs text-slate-600">
            <span className="font-bold text-slate-900 block">
              Commercial Invoicing Guidelines
            </span>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
              <li>Invoices are legally binding payment demands.</li>
              <li>Ensure the quantity and value reflect actual delivered or agreed volumes.</li>
              <li>Supporting delivery notes and weighbridge receipts can be attached after creation.</li>
              <li>HarvestLink coordinates settlement records without processing real funds.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
