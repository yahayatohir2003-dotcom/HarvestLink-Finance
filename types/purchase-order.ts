/**
 * HarvestLink Finance - Purchase Order Domain Types
 *
 * Defines domain models, status enumerations, validation contracts,
 * and commodity presets for agricultural trade in Nigeria.
 */

// Strict status union matching PostgreSQL check constraint "purchase_orders_status_check"
export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "fulfilled"
  | "cancelled"
  | "rejected";

// Database record interface for purchase_orders table
export interface PurchaseOrderRecord {
  id: string;
  order_reference: string;
  buyer_organization_id: string;
  supplier_organization_id: string | null;
  created_by: string;
  order_date: string;
  expected_delivery_date: string | null;
  currency: string;
  total_amount: number;
  status: PurchaseOrderStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Single product line item in a Purchase Order
export interface OrderItemInput {
  id?: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

// Payload for creating a new Purchase Order
export interface CreatePurchaseOrderInput {
  orderReference?: string; // Optional: auto-generated if not supplied
  supplierOrganizationId: string; // ID of the verified supplier organisation
  orderDate?: string; // YYYY-MM-DD (defaults to today)
  expectedDeliveryDate?: string; // YYYY-MM-DD
  deliveryAddress: string; // Specific warehouse or offloading facility
  notes?: string; // Quality specifications, moisture limits, delivery instructions
  items: OrderItemInput[]; // Minimum 1 line item required
  status?: "draft" | "submitted"; // Initial status (default: draft)
}

// Payload for updating an existing draft Purchase Order
export interface UpdatePurchaseOrderInput {
  supplierOrganizationId: string;
  expectedDeliveryDate?: string;
  deliveryAddress: string;
  notes?: string;
  items: OrderItemInput[];
}

// Standard agricultural commodity presets for quick selection in Nigerian trade
export interface CommodityPreset {
  name: string;
  category: string;
  defaultUnit: string;
  typicalUnitPriceNGN: number;
  descriptionTemplate: string;
}

export const NIGERIAN_COMMODITY_PRESETS: CommodityPreset[] = [
  {
    name: "White Maize (Grade A)",
    category: "Grains & Cereals",
    defaultUnit: "50kg Bags",
    typicalUnitPriceNGN: 38000,
    descriptionTemplate: "Cleaned, dried white maize (≤ 12% moisture content, clean of aflatoxin).",
  },
  {
    name: "Yellow Maize (Feed Grade)",
    category: "Grains & Cereals",
    defaultUnit: "50kg Bags",
    typicalUnitPriceNGN: 35000,
    descriptionTemplate: "Yellow feed maize for poultry and feedmills (≤ 13.5% moisture content).",
  },
  {
    name: "Soybeans (Non-GMO)",
    category: "Oilseeds & Legumes",
    defaultUnit: "Metric Tonnes",
    typicalUnitPriceNGN: 720000,
    descriptionTemplate: "Clean, dry raw soybeans suitable for solvent oil extraction and meal.",
  },
  {
    name: "Paddy Rice (Faro 44)",
    category: "Grains & Cereals",
    defaultUnit: "50kg Bags",
    typicalUnitPriceNGN: 42000,
    descriptionTemplate: "High-yield long grain paddy rice from certified off-takers.",
  },
  {
    name: "Milled Parboiled Rice (50kg)",
    category: "Finished Food Products",
    defaultUnit: "50kg Bags",
    typicalUnitPriceNGN: 68000,
    descriptionTemplate: "Sortexed, stone-free parboiled white rice.",
  },
  {
    name: "White Sorghum (Guinea Corn)",
    category: "Grains & Cereals",
    defaultUnit: "100kg Bags",
    typicalUnitPriceNGN: 70000,
    descriptionTemplate: "Industrial brewing-grade white sorghum.",
  },
  {
    name: "Raw Cashew Nuts (RCN)",
    category: "Tree Nuts & Cash Crops",
    defaultUnit: "Metric Tonnes",
    typicalUnitPriceNGN: 1450000,
    descriptionTemplate: "Export-standard RCN with Outturn (KOR) ≥ 48 lbs.",
  },
  {
    name: "Sesame Seeds (Beniseed)",
    category: "Oilseeds & Legumes",
    defaultUnit: "Metric Tonnes",
    typicalUnitPriceNGN: 1850000,
    descriptionTemplate: "Natural white sesame seeds, 99% purity level.",
  },
  {
    name: "Fermented Cocoa Beans",
    category: "Tree Nuts & Cash Crops",
    defaultUnit: "Metric Tonnes",
    typicalUnitPriceNGN: 4200000,
    descriptionTemplate: "Well-fermented, sun-dried main crop cocoa beans (moisture ≤ 7.5%).",
  },
  {
    name: "Crude Palm Oil (CPO)",
    category: "Edible Oils",
    defaultUnit: "25L Jerry Cans",
    typicalUnitPriceNGN: 32000,
    descriptionTemplate: "Cold-pressed crude palm oil for food processing and soap manufacture.",
  },
  {
    name: "Cassava Tubers (Fresh)",
    category: "Root Crops & Tubers",
    defaultUnit: "Metric Tonnes",
    typicalUnitPriceNGN: 180000,
    descriptionTemplate: "Freshly harvested high-starch cassava tubers harvested within 24h of delivery.",
  },
];

// Packaging unit options
export const PACKAGING_UNITS = [
  "50kg Bags",
  "100kg Bags",
  "Metric Tonnes",
  "Kg",
  "25L Jerry Cans",
  "Litres",
  "Crates",
  "Pieces",
];
