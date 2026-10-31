"use client";

/**
 * HarvestLink Finance - Document Upload Modal
 *
 * Interactive modal allowing buyers and suppliers to upload PDF, JPEG,
 * and PNG files up to 10MB attached to a specific purchase order.
 */

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  FileText,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  File,
} from "lucide-react";
import { DocumentType, DOCUMENT_CATEGORIES } from "@/types/document";
import {
  validateDocumentFile,
  formatBytes,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
} from "@/lib/document-utils";
import { uploadDocumentAction } from "@/app/dashboard/purchase-orders/[id]/document-actions";

interface DocumentUploadModalProps {
  purchaseOrderId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DocumentUploadModal({
  purchaseOrderId,
  isOpen,
  onClose,
  onSuccess,
}: DocumentUploadModalProps) {
  const [documentType, setDocumentType] = useState<DocumentType>("invoice");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelection = (file: File) => {
    setErrorMessage(null);

    // Client-side validation
    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Invalid file.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select a file to upload.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("purchaseOrderId", purchaseOrderId);
      formData.append("documentType", documentType);

      const res = await uploadDocumentAction(formData);

      if (!res.success) {
        setErrorMessage(res.message || "Upload failed.");
        setLoading(false);
        return;
      }

      setSuccessMessage(res.message || "Document uploaded successfully!");
      setSelectedFile(null);

      setTimeout(() => {
        setLoading(false);
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Upload Trade Document</h3>
              <p className="text-xs text-slate-500">Secure storage attached to purchase order</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Alerts */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Document Category Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Document Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
            >
              {DOCUMENT_CATEGORIES.map((cat, idx) => (
                <option key={idx} value={cat.dbType}>
                  {cat.label} ({cat.dbType})
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Categorize correctly for supply-chain underwriting and delivery verification.
            </span>
          </div>

          {/* Drag & Drop File Zone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Document File <span className="text-rose-500">*</span>
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragOver
                  ? "border-amber-600 bg-amber-50/50"
                  : selectedFile
                  ? "border-emerald-400 bg-emerald-50/30"
                  : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelection(e.target.files[0]);
                  }
                }}
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <FileCheck2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 truncate max-w-xs mx-auto">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Size: {formatBytes(selectedFile.size)} • Type: {selectedFile.type || "file"}
                    </p>
                  </div>
                  <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full">
                    Ready to upload
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    <span className="font-bold text-amber-800 hover:underline">Click to browse</span> or drag & drop here
                  </p>
                  <p className="text-xs text-slate-500">
                    PDF, JPEG, or PNG up to 10MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedFile}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-800 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-900 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Document
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
