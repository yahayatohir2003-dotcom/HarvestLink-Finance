"use client";

/**
 * HarvestLink Finance - Document List & Management Card
 *
 * Renders documents attached to a purchase order with signed URL downloads,
 * reviewer verification actions, and upload triggers.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  FileCheck2,
  Download,
  ExternalLink,
  Upload,
  CheckCircle2,
  XCircle,
  Trash2,
  ShieldCheck,
  File,
  Loader2,
  Clock,
  AlertCircle,
  Receipt,
  Truck,
  FileSpreadsheet,
} from "lucide-react";
import { DocumentRecord, DocumentType } from "@/types/document";
import { DocumentStatusBadge } from "./document-status-badge";
import { DocumentUploadModal } from "./document-upload-modal";
import { formatBytes, getDocumentCategoryLabel } from "@/lib/document-utils";
import {
  getDocumentSignedUrlAction,
  reviewDocumentAction,
  deleteDocumentAction,
} from "@/app/dashboard/purchase-orders/[id]/document-actions";

interface DocumentListCardProps {
  purchaseOrderId: string;
  documents: DocumentRecord[];
  userRole: "buyer" | "supplier" | "financier" | "admin" | string;
  currentUserId: string;
}

export function DocumentListCard({
  purchaseOrderId,
  documents,
  userRole,
  currentUserId,
}: DocumentListCardProps) {
  const router = useRouter();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isReviewer = userRole === "financier" || userRole === "admin";
  const canUpload = userRole === "buyer" || userRole === "supplier" || userRole === "admin";

  // Handle viewing document via short-lived signed URL
  const handleViewDocument = async (docId: string) => {
    setActionLoadingId(docId);
    setActionError(null);
    try {
      const res = await getDocumentSignedUrlAction(docId, false);
      if (!res.success || !res.data?.signedUrl) {
        setActionError(res.message || "Failed to generate view link.");
        return;
      }
      // Open in new browser tab
      window.open(res.data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error accessing document.";
      setActionError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle downloading document via short-lived signed URL with download flag
  const handleDownloadDocument = async (docId: string, filename: string) => {
    setActionLoadingId(docId);
    setActionError(null);
    try {
      const res = await getDocumentSignedUrlAction(docId, true);
      if (!res.success || !res.data?.signedUrl) {
        setActionError(res.message || "Failed to generate download link.");
        return;
      }

      // Create temporary download anchor
      const a = document.createElement("a");
      a.href = res.data.signedUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error downloading document.";
      setActionError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle review status transition (verified or rejected)
  const handleReviewDocument = async (docId: string, status: "verified" | "rejected") => {
    const confirmMsg =
      status === "verified"
        ? "Confirm verification of this trade document?"
        : "Are you sure you want to reject this document?";

    if (!window.confirm(confirmMsg)) return;

    let reason: string | undefined = undefined;
    if (status === "rejected") {
      const inputReason = window.prompt("Please state the reason for rejecting this document:");
      if (inputReason === null) return;
      reason = inputReason.trim() || undefined;
    }

    setActionLoadingId(docId);
    setActionError(null);
    try {
      const res = await reviewDocumentAction(docId, status, reason);
      if (!res.success) {
        setActionError(res.message || "Review action failed.");
      } else {
        setActionSuccess(res.message || "Status updated.");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error reviewing document.";
      setActionError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle document deletion
  const handleDeleteDocument = async (docId: string, filename: string) => {
    if (!window.confirm(`Delete document '${filename}'? This action cannot be undone.`)) {
      return;
    }

    setActionLoadingId(docId);
    setActionError(null);
    try {
      const res = await deleteDocumentAction(docId);
      if (!res.success) {
        setActionError(res.message || "Failed to delete document.");
      } else {
        setActionSuccess(res.message || "Document removed.");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting document.";
      setActionError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper to pick category icon
  const getCategoryIcon = (docType: DocumentType) => {
    switch (docType) {
      case "purchase_order":
        return <FileSpreadsheet className="h-4 w-4 text-amber-700" />;
      case "invoice":
        return <Receipt className="h-4 w-4 text-emerald-700" />;
      case "delivery_note":
        return <Truck className="h-4 w-4 text-blue-700" />;
      case "other":
      default:
        return <ShieldCheck className="h-4 w-4 text-purple-700" />;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-amber-700" />
              Attached Trade Documents
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
              {documents.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified contracts, invoices, and waybills stored securely in Supabase Storage.
          </p>
        </div>

        {canUpload && (
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-900 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Document
          </button>
        )}
      </div>

      {/* Action Alerts */}
      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-slate-700">No documents attached yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Upload counter-signed purchase agreements, pro-forma invoices, or delivery waybills to
            satisfy underwriting and physical audit criteria.
          </p>
          {canUpload && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload First Document
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {documents.map((doc) => {
            const isLoading = actionLoadingId === doc.id;
            const canDelete =
              (doc.uploaded_by === currentUserId && doc.verification_status !== "verified") ||
              userRole === "admin";

            return (
              <div
                key={doc.id}
                className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/50 rounded-xl px-2 -mx-2 transition-colors"
              >
                {/* File Information */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    {getCategoryIcon(doc.document_type)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 truncate" title={doc.original_filename}>
                        {doc.original_filename}
                      </p>
                      <DocumentStatusBadge status={doc.verification_status} size="sm" />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {getDocumentCategoryLabel(doc.document_type)}
                      </span>
                      <span>•</span>
                      <span>{formatBytes(doc.file_size_bytes)}</span>
                      <span>•</span>
                      <span>
                        Uploaded {new Date(doc.created_at).toLocaleDateString("en-NG")}
                        {doc.uploaderName && ` by ${doc.uploaderName}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* View Document */}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleViewDocument(doc.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    title="View file via signed URL"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    View
                  </button>

                  {/* Download Document */}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleDownloadDocument(doc.id, doc.original_filename)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Download file directly"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    Download
                  </button>

                  {/* Reviewer / Admin Actions */}
                  {isReviewer && doc.verification_status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleReviewDocument(doc.id, "verified")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition-colors"
                        title="Mark document verified"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Verify
                      </button>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleReviewDocument(doc.id, "rejected")}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                        title="Reject document"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </>
                  )}

                  {/* Delete Document */}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleDeleteDocument(doc.id, doc.original_filename)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <DocumentUploadModal
        purchaseOrderId={purchaseOrderId}
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          setActionSuccess("Document uploaded successfully!");
          router.refresh();
        }}
      />
    </div>
  );
}
