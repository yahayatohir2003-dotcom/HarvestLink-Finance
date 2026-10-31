/**
 * HarvestLink Finance - Document Management Domain Types
 *
 * Defines contracts, categories, and status enumerations for
 * transactional trade documents attached to purchase orders.
 */

// Database document type check constraint values
export type DocumentType =
  | "purchase_order"
  | "invoice"
  | "delivery_note"
  | "other";

// Database verification status check constraint values
export type DocumentVerificationStatus =
  | "pending"
  | "verified"
  | "rejected";

// Human-friendly document category definition
export interface DocumentCategoryConfig {
  dbType: DocumentType;
  label: string;
  description: string;
  recommendedRole: "buyer" | "supplier" | "both";
  iconName: string;
}

export const DOCUMENT_CATEGORIES: DocumentCategoryConfig[] = [
  {
    dbType: "purchase_order",
    label: "Purchase Order Document",
    description: "Counter-signed purchase agreement or contract document.",
    recommendedRole: "buyer",
    iconName: "FileSpreadsheet",
  },
  {
    dbType: "invoice",
    label: "Commercial Invoice",
    description: "Pro-forma or final commercial tax invoice from the supplier.",
    recommendedRole: "supplier",
    iconName: "Receipt",
  },
  {
    dbType: "delivery_note",
    label: "Delivery Receipt / Waybill",
    description: "Physical goods received note, waybill, or weighbridge ticket.",
    recommendedRole: "both",
    iconName: "Truck",
  },
  {
    dbType: "other",
    label: "Quality & Inspection Certificate",
    description: "Moisture test, aflatoxin test, phytosanitary or KOR outturn certificate.",
    recommendedRole: "supplier",
    iconName: "ShieldCheck",
  },
  {
    dbType: "other",
    label: "Other Supporting Document",
    description: "Insurance policy, warehousing receipt, or miscellaneous evidence.",
    recommendedRole: "both",
    iconName: "FileText",
  },
];

// Document metadata row as stored in 'documents' table
export interface DocumentRecord {
  id: string;
  purchase_order_id: string | null;
  financing_request_id: string | null;
  uploaded_by: string;
  document_type: DocumentType;
  original_filename: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  verification_status: DocumentVerificationStatus;
  created_at: string;
  uploaderName?: string;
}

// Upload payload interface
export interface DocumentUploadPayload {
  purchaseOrderId: string;
  documentType: DocumentType;
  file: File;
}

// Verification review payload interface
export interface DocumentReviewPayload {
  documentId: string;
  status: "verified" | "rejected";
  reason?: string;
}
