"use client";

/**
 * HarvestLink Finance - Purchase Orders Client List View
 *
 * Provides real-time client-side search, status tab filtering,
 * key summary financial metrics, and responsive table/card layouts.
 */

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  PlusCircle,
  FileSpreadsheet,
  Building2,
  Calendar,
  ArrowUpRight,
  Filter,
  DollarSign,
  TrendingUp,
  Package,
} from "lucide-react";
import { PoStatusBadge } from "./po-status-badge";
import { formatCurrencyNGN } from "@/lib/utils";
import { PurchaseOrderStatus } from "@/types/purchase-order";

export interface PurchaseOrderListItem {
  id: string;
  orderReference: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  currency: string;
  totalAmount: number;
  status: PurchaseOrderStatus | string;
  buyerOrgName: string;
  supplierOrgName: string;
  itemsCount: number;
  createdAt: string;
}

interface PoListViewProps {
  orders: PurchaseOrderListItem[];
  userRole: "buyer" | "supplier" | "financier" | "admin" | string;
  userOrgName: string;
}

export function PoListView({ orders, userRole, userOrgName }: PoListViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isBuyer = userRole === "buyer" || userRole === "admin";

  // Filtered orders based on search query and active status tab
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }

      // Search term filter (matches reference, buyer, supplier)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesRef = order.orderReference.toLowerCase().includes(term);
        const matchesBuyer = order.buyerOrgName.toLowerCase().includes(term);
        const matchesSupplier = order.supplierOrgName.toLowerCase().includes(term);
        return matchesRef || matchesBuyer || matchesSupplier;
      }

      return true;
    });
  }, [orders, statusFilter, searchTerm]);

  // Financial summary metrics
  const totalVolume = useMemo(() => {
    return orders.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);
  }, [orders]);

  const activeCount = useMemo(() => {
    return orders.filter((o) => o.status === "submitted" || o.status === "accepted").length;
  }, [orders]);

  const fulfilledCount = useMemo(() => {
    return orders.filter((o) => o.status === "fulfilled").length;
  }, [orders]);

  const draftCount = useMemo(() => {
    return orders.filter((o) => o.status === "draft").length;
  }, [orders]);

  const statusTabs = [
    { id: "all", label: "All Orders", count: orders.length },
    { id: "draft", label: "Drafts", count: draftCount },
    { id: "submitted", label: "Submitted", count: orders.filter((o) => o.status === "submitted").length },
    { id: "accepted", label: "Accepted", count: orders.filter((o) => o.status === "accepted").length },
    { id: "fulfilled", label: "Fulfilled", count: fulfilledCount },
    { id: "cancelled", label: "Cancelled", count: orders.filter((o) => o.status === "cancelled").length },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Supply-Chain Trade Documents
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Purchase Orders
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Commercial agreements and financing contracts for{" "}
            <span className="font-semibold text-slate-800">{userOrgName}</span>.
          </p>
        </div>

        {isBuyer && (
          <Link
            href="/dashboard/purchase-orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow hover:bg-amber-900 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Issue New Purchase Order
          </Link>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Total Contract Value</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatCurrencyNGN(totalVolume)}
          </p>
          <span className="mt-1 block text-xs text-slate-500">
            Across {orders.length} total orders
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>In-Flight Orders</span>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-900">{activeCount} Active</p>
          <span className="mt-1 block text-xs text-slate-500">Submitted or accepted</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Delivered & Fulfilled</span>
            <Package className="h-4 w-4 text-brand-700" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-brand-900">{fulfilledCount} Orders</p>
          <span className="mt-1 block text-xs text-slate-500">Fulfillment verified</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Pending Drafts</span>
            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-700">{draftCount} Drafts</p>
          <span className="mt-1 block text-xs text-slate-500">Awaiting submission</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by PO number, buyer, or supplier organisation..."
              className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          {/* Quick Clear Search */}
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-slate-100 pt-3">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? "bg-amber-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  statusFilter === tab.id ? "bg-amber-950/60 text-amber-100" : "bg-slate-200 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No purchase orders found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== "all"
                ? "No purchase orders match your search or filter criteria. Try clearing the filter."
                : isBuyer
                ? "Your organisation has not issued any purchase orders yet. Click 'Issue New Purchase Order' above to get started."
                : "No purchase orders have been assigned to your supplier organisation yet."}
            </p>
            {isBuyer && !searchTerm && statusFilter === "all" && (
              <div className="pt-2">
                <Link
                  href="/dashboard/purchase-orders/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-900"
                >
                  <PlusCircle className="h-4 w-4" />
                  Issue Your First Purchase Order
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card List (< 640px) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredOrders.map((po) => (
                <div key={po.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {po.orderReference}
                    </span>
                    <PoStatusBadge status={po.status} size="sm" />
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium truncate">
                      {userRole === "supplier" ? `Buyer: ${po.buyerOrgName}` : `Supplier: ${po.supplierOrgName}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                    <span className="text-slate-500 font-medium">
                      {po.itemsCount} {po.itemsCount === 1 ? "item" : "items"}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {formatCurrencyNGN(po.totalAmount)}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/purchase-orders/${po.id}`}
                    className="min-h-[44px] w-full flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/60 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    <span>View Purchase Order</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">PO Number</th>
                  <th className="px-6 py-3.5">
                    {userRole === "supplier" ? "Issuing Buyer" : "Assigned Supplier"}
                  </th>
                  <th className="px-6 py-3.5">Order Date</th>
                  <th className="px-6 py-3.5">Expected Delivery</th>
                  <th className="px-6 py-3.5">Items</th>
                  <th className="px-6 py-3.5 text-right">Total Amount (₦)</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <Link
                        href={`/dashboard/purchase-orders/${po.id}`}
                        className="hover:text-amber-800 hover:underline"
                      >
                        {po.orderReference}
                      </Link>
                    </td>

                    <td className="px-6 py-4 font-medium text-slate-800 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>
                          {userRole === "supplier" ? po.buyerOrgName : po.supplierOrgName}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {po.orderDate}
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {po.expectedDeliveryDate || "Not set"}
                    </td>

                    <td className="px-6 py-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {po.itemsCount} {po.itemsCount === 1 ? "item" : "items"}
                    </td>

                    <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                      {formatCurrencyNGN(po.totalAmount)}
                    </td>

                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <PoStatusBadge status={po.status} size="sm" />
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/dashboard/purchase-orders/${po.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 transition-colors"
                      >
                        View
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
