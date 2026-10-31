"use client";

/**
 * HarvestLink Finance - Purchase Order Creation Form
 *
 * Interactive multi-item creation form supporting real-time line total
 * calculations, agricultural presets, supplier selection, and server action submission.
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Sparkles,
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
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
  generatePoReference,
} from "@/lib/po-utils";
import { formatCurrencyNGN } from "@/lib/utils";
import { createPurchaseOrderAction } from "@/app/dashboard/purchase-orders/actions";

interface SupplierOption {
  id: string;
  name: string;
  organization_type: string;
  address: string | null;
  phone: string | null;
}

interface PoCreateFormProps {
  suppliers: SupplierOption[];
  buyerOrgName: string;
}

export function PoCreateForm({ suppliers, buyerOrgName }: PoCreateFormProps) {
  const router = useRouter();

  // Basic order details state
  const [orderReference, setOrderReference] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Product line items state (initialized with 1 empty item)
  const [items, setItems] = useState<OrderItemInput[]>([
    {
      itemName: "White Maize (Grade A)",
      description: "Cleaned, dried white maize (≤ 12% moisture content).",
      quantity: 100,
      unit: "50kg Bags",
      unitPrice: 38000,
      lineTotal: 3800000,
    },
  ]);

  // Form submission state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize auto-generated PO reference and today's date on client mount
  useEffect(() => {
    setOrderReference(generatePoReference());
    const today = new Date().toISOString().split("T")[0];
    setOrderDate(today);

    // Default expected delivery date: 14 days from today
    const delivery = new Date();
    delivery.setDate(delivery.getDate() + 14);
    setExpectedDeliveryDate(delivery.toISOString().split("T")[0]);

    // Select first supplier if available
    if (suppliers.length > 0 && !supplierId) {
      setSupplierId(suppliers[0].id);
    }
  }, [suppliers]);

  // Calculate live grand total across all line items
  const grandTotal = calculateOrderTotal(items);

  // Handle line item field changes and recalculate line total
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

  // Quick preset commodity autofill
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

  // Add new product line item
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

  // Remove line item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMessage("At least one product line item is required.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle form submission
  const handleSubmit = async (submitStatus: "draft" | "submitted") => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Front-end validation checks
    if (!supplierId) {
      setErrorMessage("Please select a verified supplier organisation.");
      setLoading(false);
      return;
    }

    if (!deliveryAddress.trim()) {
      setErrorMessage("Delivery address is required for logistics fulfillment.");
      setLoading(false);
      return;
    }

    if (items.some((itm) => !itm.itemName.trim() || itm.quantity <= 0 || itm.unitPrice < 0)) {
      setErrorMessage("All line items must have a valid commodity name, quantity (> 0), and unit price.");
      setLoading(false);
      return;
    }

    try {
      const result = await createPurchaseOrderAction({
        orderReference,
        supplierOrganizationId: supplierId,
        orderDate,
        expectedDeliveryDate,
        deliveryAddress,
        notes,
        items,
        status: submitStatus,
      });

      if (!result.success) {
        setErrorMessage(result.message || "Failed to create purchase order.");
        setLoading(false);
        return;
      }

      setSuccessMessage(result.message || "Purchase order created successfully!");

      // Redirect to the newly created purchase order detail view
      setTimeout(() => {
        router.push(`/dashboard/purchase-orders/${result.data?.orderId}`);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit("submitted");
      }}
      className="space-y-8"
    >
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            href="/dashboard/purchase-orders"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Purchase Orders
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Issue New Purchase Order
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Issuing as: <span className="font-semibold text-amber-900">{buyerOrgName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit("draft")}
            className="flex-1 sm:flex-none min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4 text-slate-500" />
            Save as Draft
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 sm:flex-none min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-800 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-900 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit Purchase Order
          </button>
        </div>
      </div>

      {/* Alert Messages */}
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

      {/* Section 1: Order Metadata & Counterparties */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="h-5 w-5 text-amber-700" />
          Order & Counterparty Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Unique PO Reference Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Purchase Order Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
              placeholder="e.g. HL-PO-20261030-1001"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Unique identifier for this commercial agreement.
            </span>
          </div>

          {/* Supplier Selection */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Designated Commodity Supplier <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
            >
              <option value="" disabled>
                -- Select a verified supplier from database --
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.address ? `(${s.address})` : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Only verified agribusiness suppliers can receive and finance purchase orders.
            </span>
          </div>

          {/* Issue Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              Order Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
          </div>

          {/* Expected Delivery Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
          </div>

          {/* Currency Indicator */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Settlement Currency
            </label>
            <input
              type="text"
              disabled
              value="NGN (Nigerian Naira - ₦)"
              className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-600 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Delivery Address & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              Delivery Address & Warehouse <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="e.g. Silo Complex 3, Bompai Industrial Estate, Kano, Kano State"
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Precise offloading location for logistics and delivery confirmation.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              Specifications & Quality Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Moisture content strictly ≤ 12%. Weighbridge tickets required upon delivery."
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Commodity inspection benchmarks and offloading instructions.
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Agricultural Products Line Items */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-700" />
              Agricultural Products & Line Items
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add multiple commodities. Line totals and grand total calculate automatically.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Another Product
          </button>
        </div>

        {/* Demonstration Context Banner */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
          <span>
            <strong>Illustrative Demonstration Scenarios:</strong> Commodity presets (such as White Maize, Soybean, or Cashew) represent illustrative supply-chain templates for platform evaluation. Line items, quantities, and pricing are fully customizable to any crop.
          </span>
        </div>

        {/* Line Items Container */}
        <div className="space-y-6">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 relative transition-all"
            >
              {/* Item Header & Preset Selector */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100/70 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                  Item #{index + 1}
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-slate-500 font-medium">Quick Preset:</span>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-sm focus:border-amber-600 focus:outline-none"
                    onChange={(e) => handleApplyPreset(index, e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose Nigerian Commodity...
                    </option>
                    {NIGERIAN_COMMODITY_PRESETS.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} (~₦{p.typicalUnitPriceNGN.toLocaleString()}/{p.defaultUnit})
                      </option>
                    ))}
                  </select>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="ml-auto sm:ml-2 rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove this item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Item Form Inputs */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                {/* Commodity Name */}
                <div className="lg:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Commodity / Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={item.itemName}
                    onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                    placeholder="e.g. White Maize (Grade A)"
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>

                {/* Packaging Unit */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Packaging Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none"
                  >
                    {PACKAGING_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>

                {/* Unit Price (NGN) */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Unit Price (₦) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>

                {/* Automatically Calculated Line Total */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Line Total (₦)
                  </label>
                  <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm font-extrabold text-amber-950">
                    {formatCurrencyNGN(item.lineTotal)}
                  </div>
                </div>

                {/* Line Item Description */}
                <div className="sm:col-span-2 lg:col-span-12">
                  <label className="block text-xs font-medium text-slate-600">
                    Product Description / Specifications (optional)
                  </label>
                  <input
                    type="text"
                    value={item.description || ""}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                    placeholder="e.g. Moisture ≤ 12%, clean sorted grains free from weevils"
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live Financial Summary */}
        <div className="mt-8 rounded-xl bg-slate-900 p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Commercial Summary
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                Total payable to supplier upon satisfactory delivery and verification.
              </p>
            </div>

            <div className="text-right w-full sm:w-auto">
              <span className="block text-xs text-slate-400 uppercase">Calculated Order Total</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {formatCurrencyNGN(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4 border-t border-slate-200">
        <Link
          href="/dashboard/purchase-orders"
          className="w-full sm:w-auto text-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={loading}
          onClick={() => handleSubmit("draft")}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4 text-slate-500" />
          Save as Draft
        </button>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-800 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-amber-900 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Submit Purchase Order
        </button>
      </div>
    </form>
  );
}
