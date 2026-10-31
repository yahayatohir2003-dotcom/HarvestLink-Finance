/**
 * HarvestLink Finance - Document Utilities & Validation Helpers
 *
 * Implements client and server-side file size/type validation,
 * storage path sanitization, and verification status formatting.
 */

import { DocumentVerificationStatus, DocumentType } from "@/types/document";

// Maximum allowed file size in bytes (10 Megabytes)
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10,485,760 bytes

// Allowed MIME types enforced by Supabase Storage bucket 'transaction-documents'
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

// Human-readable file size formatter (e.g. 2.45 MB)
export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Validates a file's size and MIME type.
 * Ensures the file is <= 10MB and is either a PDF, JPEG, or PNG.
 */
export function validateDocumentFile(file: {
  size: number;
  type: string;
  name: string;
}): { valid: boolean; error?: string } {
  // Check file presence
  if (!file || !file.name) {
    return { valid: false, error: "Please select a valid document file to upload." };
  }

  // Check file size (max 10MB)
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 10MB limit (Selected: ${formatBytes(file.size)}). Please choose a smaller file.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "The selected file is empty (0 Bytes)." };
  }

  // Check MIME type
  const isMimeAllowed = ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type.toLowerCase());

  // Also check extension fallback in case browser sent empty mime type
  const extMatch = file.name.match(/\.([0-9a-z]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : "";
  const isExtAllowed = ["pdf", "jpg", "jpeg", "png"].includes(ext);

  if (!isMimeAllowed && !isExtAllowed) {
    return {
      valid: false,
      error: "Unsupported file type. Only PDF, JPEG (.jpg/.jpeg), and PNG files are accepted.",
    };
  }

  return { valid: true };
}

/**
 * Generates the standardized storage path required by HarvestLink Finance:
 * Pattern: ${purchaseOrderId}/${documentType}_${timestamp}_${sanitizedFilename}
 */
export function generateStoragePath(
  purchaseOrderId: string,
  documentType: DocumentType,
  originalFilename: string
): string {
  // Sanitize filename: replace spaces and special characters with underscores
  const cleanName = originalFilename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_");

  const timestamp = Date.now();
  return `${purchaseOrderId}/${documentType}_${timestamp}_${cleanName}`;
}

/**
 * Verification status badge configuration.
 */
export interface VerificationStatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  iconName: "Clock" | "CheckCircle2" | "XCircle";
}

export function getVerificationStatusConfig(
  status: DocumentVerificationStatus | string
): VerificationStatusConfig {
  switch (status) {
    case "verified":
      return {
        label: "Verified",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-800",
        borderClass: "border-emerald-300",
        iconName: "CheckCircle2",
      };
    case "rejected":
      return {
        label: "Rejected",
        bgClass: "bg-rose-50",
        textClass: "text-rose-800",
        borderClass: "border-rose-300",
        iconName: "XCircle",
      };
    case "pending":
    default:
      return {
        label: "Pending Verification",
        bgClass: "bg-amber-50",
        textClass: "text-amber-800",
        borderClass: "border-amber-300",
        iconName: "Clock",
      };
  }
}

/**
 * Human-friendly category label helper.
 */
export function getDocumentCategoryLabel(docType: DocumentType | string): string {
  switch (docType) {
    case "purchase_order":
      return "Purchase Order";
    case "invoice":
      return "Commercial Invoice";
    case "delivery_note":
      return "Delivery Receipt / Waybill";
    case "other":
      return "Supporting Document";
    default:
      return docType;
  }
}
