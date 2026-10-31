"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Coins,
  ArrowUpRight,
  Filter,
  FileText,
  Building,
  CheckCircle2,
  Clock,
  Eye,
  XCircle,
} from "lucide-react";
import {
  EnrichedFinancingRequest,
  FinancingRequestStatus,
  FINANCING_STATUS_CONFIGS,
} from "@/types/financing";
import { FinancingStatusBadge } from "./financing-status-badge";

interface FinancingListViewProps {
  requests: EnrichedFinancingRequest[];
  userRole: "supplier" | "financier" | "buyer" | "admin";
}

export function FinancingListView({
  requests,
  userRole,
}: FinancingListViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const canApply = userRole === "supplier" || userRole === "admin";

  // Filter requests by search term and status
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Status filter
      if (selectedStatus !== "all" && req.status !== selectedStatus) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const poRef = req.purchaseOrder?.order_reference?.toLowerCase() || "";
        const purpose = req.purpose?.toLowerCase() || "";
        const buyerName = req.purchaseOrder?.buyerOrganization?.name?.toLowerCase() || "";
        const supplierName = req.purchaseOrder?.supplierOrganization?.name?.toLowerCase() || "";
        const requester = req.requester?.full_name?.toLowerCase() || "";

        return (
          poRef.includes(query) ||
          purpose.includes(query) ||
          buyerName.includes(query) ||
          supplierName.includes(query) ||
          requester.includes(query)
        );
      }

      return true;
    });
  }, [requests, searchTerm, selectedStatus]);

  // Aggregate summary metrics
  const totalCount = requests.length;
  const totalCapitalRequested = requests.reduce((acc, r) => acc + Number(r.requested_amount || 0), 0);
  const approvedCapital = requests
    .filter((r) => r.status === "approved")
    .reduce((acc, r) => acc + Number(r.requested_amount || 0), 0);
  const pendingCount = requests.filter(
    (r) => r.status === "submitted" || r.status === "under_review"
  ).length;

  return (
    <div className="space-y-6">
      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Total Applications</span>
            <FileText className="h-4 w-4 text-slate-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {totalCount} <span className="text-sm font-normal text-slate-500">requests</span>
          </p>
          <span className="mt-1 block text-xs text-slate-500">Across active purchase orders</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Under Review Queue</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-900">
            {pendingCount} <span className="text-sm font-normal text-amber-700">pending</span>
          </p>
          <span className="mt-1 block text-xs text-amber-700 font-medium">Awaiting underwriting decisions</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Requested Capital</span>
            <Coins className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            ₦{totalCapitalRequested.toLocaleString()}
          </p>
          <span className="mt-1 block text-xs text-slate-500 font-mono">Total facility pipeline</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Approved Facilities</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-900">
            ₦{approvedCapital.toLocaleString()}
          </p>
          <span className="mt-1 block text-xs text-emerald-700 font-medium">Partner credit commitments</span>
        </div>
      </div>

      {/* Control Bar: Search, Status Filter, and New Request Button */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by PO reference, buyer, purpose, or requester..."
            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-emerald-600 focus:outline-none"
          >
            <option value="all">All Statuses ({requests.length})</option>
            <option value="submitted">Submitted (Queue)</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="draft">Draft</option>
            <option value="withdrawn">Withdrawn</option>
          </select>

          {/* New Request Button for Suppliers */}
          {canApply && (
            <Link
              href="/dashboard/financing/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800 transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Apply for Financing
            </Link>
          )}
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Coins className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              No Financing Requests Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || selectedStatus !== "all"
                ? "No applications matched your filter criteria. Try adjusting your search query or status filter."
                : canApply
                ? "You have not submitted any financing applications yet. Select an eligible purchase order to get started."
                : "No financing applications are currently in the queue."}
            </p>
            {canApply && (
              <div className="pt-2">
                <Link
                  href="/dashboard/financing/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Application
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card List (< 640px) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredRequests.map((req) => {
                const poTotal = Number(req.purchaseOrder?.total_amount || 0);
                const reqAmount = Number(req.requested_amount);
                const ratio = poTotal > 0 ? ((reqAmount / poTotal) * 100).toFixed(0) : "0";

                return (
                  <div key={req.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {req.purchaseOrder?.order_reference || `REQ #${req.id.slice(0, 8)}`}
                      </span>
                      <FinancingStatusBadge status={req.status} size="sm" />
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold truncate">
                          {req.purchaseOrder?.buyerOrganization?.name || "Corporate Buyer"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Supplier: {req.purchaseOrder?.supplierOrganization?.name || "Supplier"}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 border border-slate-200">
                        {ratio}% of PO
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        ₦{reqAmount.toLocaleString()}
                      </span>
                    </div>

                    <Link
                      href={`/dashboard/financing/${req.id}`}
                      className="min-h-[44px] w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors"
                    >
                      <span>View Application Dossier</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">PO Reference</th>
                  <th className="px-4 py-3.5">Counterparties</th>
                  <th className="px-4 py-3.5 text-right">Requested Capital</th>
                  <th className="px-4 py-3.5 text-center">Ratio</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Submitted Date</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const poTotal = Number(req.purchaseOrder?.total_amount || 0);
                  const reqAmount = Number(req.requested_amount);
                  const ratio = poTotal > 0 ? ((reqAmount / poTotal) * 100).toFixed(0) : "0";

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* PO Reference */}
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <Link
                          href={`/dashboard/financing/${req.id}`}
                          className="hover:text-emerald-800 transition-colors flex items-center gap-1"
                        >
                          {req.purchaseOrder?.order_reference || "PO N/A"}
                        </Link>
                        <span className="block text-[10px] font-normal text-slate-400 font-mono">
                          ID: #{req.id.slice(0, 8)}
                        </span>
                      </td>

                      {/* Counterparties */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 flex items-center gap-1">
                          <Building className="h-3 w-3 text-slate-400 shrink-0" />
                          {req.purchaseOrder?.buyerOrganization?.name || "Corporate Buyer"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Supplier: {req.purchaseOrder?.supplierOrganization?.name || "Supplier"}
                        </p>
                      </td>

                      {/* Requested Capital */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-extrabold text-slate-900">
                          ₦{reqAmount.toLocaleString()}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          PO Total: ₦{poTotal.toLocaleString()}
                        </span>
                      </td>

                      {/* Ratio */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 border border-slate-200">
                          {ratio}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <FinancingStatusBadge status={req.status} size="sm" />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                        {req.submitted_at
                          ? new Date(req.submitted_at).toLocaleDateString("en-GB")
                          : new Date(req.created_at).toLocaleDateString("en-GB")}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/dashboard/financing/${req.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-emerald-800 transition-colors"
                        >
                          <span>Dossier</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
