"use client";

/**
 * HarvestLink Finance - Purchase Order Edit Form
 *
 * Allows buyers to edit draft purchase orders, adjust commodity quantities,
 * update prices, delivery addresses, and delivery dates with live recalculation.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react";
import {
  NIGERIAN_COMMODITY_PRESETS,
  PACKAGING_UNITS,
  OrderItemInput,
} from "@/types/purchase-order";
import {
  calculateLineTotal,
  calculateOrderTotal,
  decodePoDescription,
} from "@/lib/po-utils";
import { formatCurrencyNGN } from "@/lib/utils";
import { updatePurchaseOrderAction } from "@/app/dashboard/purchase-orders/actions";

interface SupplierOption {
  id: string;
  name: string;
  organization_type: string;
  address: string | null;
  phone: string | null;
}

interface ExistingOrderData {
  id: string;
  orderReference: string;
  supplierOrganizationId: string | null;
  expectedDeliveryDate: string | null;
  description: string | null;
  status: string;
  items: Array<{
    id: string;
    item_name: string;
    description: string | null;
    quantity: number;
    unit: string;
    unit_price: number;
    line_total: number;
  }>;
}

interface PoEditFormProps {
  order: ExistingOrderData;
  suppliers: SupplierOption[];
  buyerOrgName: string;
}

export function PoEditForm({ order, suppliers, buyerOrgName }: PoEditFormProps) {
  const router = useRouter();

  // Decode existing delivery address and notes from order.description
  const decodedDesc = decodePoDescription(order.description);

  // Form states
  const [supplierId, setSupplierId] = useState(order.supplierOrganizationId || "");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    order.expectedDeliveryDate ? order.expectedDeliveryDate.split("T")[0] : ""
  );
  const [deliveryAddress, setDeliveryAddress] = useState(decodedDesc.deliveryAddress);
  const [notes, setNotes] = useState(decodedDesc.notes);

  // Line items state
  const [items, setItems] = useState<OrderItemInput[]>(
    order.items.map((itm) => ({
      id: itm.id,
      itemName: itm.item_name,
      description: itm.description || "",
      quantity: Number(itm.quantity),
      unit: itm.unit,
      unitPrice: Number(itm.unit_price),
      lineTotal: Number(itm.line_total),
    }))
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate live grand total
  const grandTotal = calculateOrderTotal(items);

  const handleItemChange = (
    index: number,
    field: keyof OrderItemInput,
    value: string | number
  ) => {
    setItems((prevItems) => {
      const updated = [...prevItems];
      const target = { ...updated[index], [field]: value };

      if (field === "quantity" || field === "unitPrice") {
        const q = field === "quantity" ? Number(value) : target.quantity;
        const p = field === "unitPrice" ? Number(value) : target.unitPrice;
        target.lineTotal = calculateLineTotal(q, p);
      }

      updated[index] = target;
      return updated;
    });
  };

  const handleApplyPreset = (index: number, presetName: string) => {
    const preset = NIGERIAN_COMMODITY_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;

    setItems((prevItems) => {
      const updated = [...prevItems];
      const currentQty = updated[index].quantity || 10;
      updated[index] = {
        ...updated[index],
        itemName: preset.name,
        description: preset.descriptionTemplate,
        unit: preset.defaultUnit,
        unitPrice: preset.typicalUnitPriceNGN,
        lineTotal: calculateLineTotal(currentQty, preset.typicalUnitPriceNGN),
      };
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemName: "",
        description: "",
        quantity: 10,
        unit: "50kg Bags",
        unitPrice: 0,
        lineTotal: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMessage("At least one product line item is required.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supplierId) {
      setErrorMessage("Please select a verified supplier organisation.");
      setLoading(false);
      return;
    }

    if (!deliveryAddress.trim()) {
      setErrorMessage("Delivery address is required.");
      setLoading(false);
      return;
    }

    if (items.some((itm) => !itm.itemName.trim() || itm.quantity <= 0 || itm.unitPrice < 0)) {
      setErrorMessage("All line items must have a valid commodity name, quantity (> 0), and unit price.");
      setLoading(false);
      return;
    }

    try {
      const result = await updatePurchaseOrderAction(order.id, {
        supplierOrganizationId: supplierId,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        deliveryAddress,
        notes,
        items,
      });

      if (!result.success) {
        setErrorMessage(result.message || "Failed to update purchase order.");
        setLoading(false);
        return;
      }

      setSuccessMessage("Purchase order updated successfully!");
      setTimeout(() => {
        router.push(`/dashboard/purchase-orders/${order.id}`);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            href={`/dashboard/purchase-orders/${order.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Order Details
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Edit Purchase Order: <span className="font-mono text-amber-800">{order.orderReference}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Operating as: <span className="font-semibold text-amber-900">{buyerOrgName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/purchase-orders/${order.id}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-800 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-900 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="text-sm font-medium">{errorMessage}</div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div className="text-sm font-medium">{successMessage}</div>
        </div>
      )}

      {/* Counterparties & Dates */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="h-5 w-5 text-amber-700" />
          Order Specifications
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">PO Reference</label>
            <input
              type="text"
              disabled
              value={order.orderReference}
              className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-600 cursor-not-allowed"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Designated Supplier <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.address ? `(${s.address})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              Delivery Address & Warehouse <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              Quality Notes & Specifications
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Product Line Items</h2>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Another Product
          </button>
        </div>

        <div className="space-y-6">
          {items.map((item, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-amber-900 bg-amber-100/70 px-2.5 py-0.5 rounded-md">
                  Item #{index + 1}
                </span>

                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                    onChange={(e) => handleApplyPreset(index, e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Autofill Nigerian Commodity...
                    </option>
                    {NIGERIAN_COMMODITY_PRESETS.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Commodity Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={item.itemName}
                    onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Unit</label>
                  <select
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {PACKAGING_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Quantity</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Unit Price (₦)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Line Total (₦)</label>
                  <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">
                    {formatCurrencyNGN(item.lineTotal)}
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-12">
                  <label className="block text-xs font-medium text-slate-600">Specifications / Notes</label>
                  <input
                    type="text"
                    value={item.description || ""}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total Summary */}
        <div className="mt-6 rounded-xl bg-slate-900 p-6 text-white flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold uppercase text-amber-400">Recalculated Total</span>
            <p className="text-xs text-slate-400">Live order amount based on updated line items.</p>
          </div>
          <span className="text-2xl sm:text-3xl font-extrabold text-white">
            {formatCurrencyNGN(grandTotal)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Link
          href={`/dashboard/purchase-orders/${order.id}`}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-800 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-900 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>
    </form>
  );
}
