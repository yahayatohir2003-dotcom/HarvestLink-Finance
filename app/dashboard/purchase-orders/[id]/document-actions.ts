"use server";

/**
 * HarvestLink Finance - Document Management Server Actions
 *
 * Implements server-side document upload, private storage interactions,
 * signed URL generation, reviewer verification workflows, and audit logging.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DocumentType, DocumentVerificationStatus } from "@/types/document";
import {
  generateStoragePath,
  validateDocumentFile,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from "@/lib/document-utils";

export interface DocumentActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Server Action: Upload a transactional document attached to a Purchase Order.
 * Validates file size, mime type, counterparty authorization, saves to private
 * storage under `${purchaseOrderId}/...`, saves metadata in 'documents',
 * and handles automatic rollback on failures.
 */
export async function uploadDocumentAction(
  formData: FormData
): Promise<DocumentActionResult<{ documentId: string; storagePath: string }>> {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to upload documents." };
    }

    // 2. Extract form data
    const file = formData.get("file") as File | null;
    const purchaseOrderId = formData.get("purchaseOrderId") as string | null;
    const documentType = formData.get("documentType") as DocumentType | null;

    if (!file || !purchaseOrderId || !documentType) {
      return { success: false, message: "Missing required document upload parameters." };
    }

    // 3. Server-side validation of file size and MIME type
    const validation = validateDocumentFile({
      size: file.size,
      type: file.type,
      name: file.name,
    });

    if (!validation.valid) {
      return { success: false, message: validation.error || "File validation failed." };
    }

    // 4. Query user profile to verify role and organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const admin = createAdminClient();

    // 5. Query purchase order to verify counterparty authorization
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("id, order_reference, buyer_organization_id, supplier_organization_id")
      .eq("id", purchaseOrderId)
      .maybeSingle();

    if (poErr || !po) {
      return { success: false, message: "Purchase order not found." };
    }

    const isBuyer = profile?.organization_id === po.buyer_organization_id;
    const isSupplier = profile?.organization_id === po.supplier_organization_id;
    const isAdmin = profile?.role === "admin";

    // Only buyer, supplier, or platform admin can attach documents to this order
    if (!isBuyer && !isSupplier && !isAdmin) {
      return {
        success: false,
        message: "Unauthorized: Only counterparties to this purchase order can upload attached documents.",
      };
    }

    // 6. Generate storage path organized by PO UUID
    const storagePath = generateStoragePath(purchaseOrderId, documentType, file.name);

    // 7. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 8. Upload to private Supabase Storage bucket 'transaction-documents'
    const { data: storageData, error: storageErr } = await admin.storage
      .from("transaction-documents")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (storageErr || !storageData) {
      return {
        success: false,
        message: `Storage upload failed: ${storageErr?.message || "Storage error"}`,
      };
    }

    // 9. Save exact file metadata in 'documents' table
    const { data: doc, error: docErr } = await admin
      .from("documents")
      .insert({
        purchase_order_id: purchaseOrderId,
        financing_request_id: null,
        uploaded_by: user.id,
        document_type: documentType,
        original_filename: file.name,
        storage_path: storagePath,
        mime_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
        verification_status: "pending",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    // ROLLBACK HANDLING: If database insert fails, remove the uploaded file to prevent orphans
    if (docErr || !doc) {
      await admin.storage.from("transaction-documents").remove([storagePath]);
      return {
        success: false,
        message: `Database registration failed: ${docErr?.message}. Storage file was rolled back.`,
      };
    }

    // 10. Record immutable audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "DOCUMENT_UPLOADED",
      entity_table: "documents",
      entity_id: doc.id,
      details: {
        purchase_order_id: purchaseOrderId,
        order_reference: po.order_reference,
        original_filename: file.name,
        document_type: documentType,
        file_size_bytes: file.size,
        storage_path: storagePath,
      },
      created_at: new Date().toISOString(),
    });

    revalidatePath(`/dashboard/purchase-orders/${purchaseOrderId}`);

    return {
      success: true,
      message: `Document '${file.name}' uploaded and queued for verification.`,
      data: { documentId: doc.id, storagePath },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to upload document.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Generate a secure, short-lived Signed URL for an authorised user
 * to view or download a private file from 'transaction-documents'.
 */
export async function getDocumentSignedUrlAction(
  documentId: string,
  download = false
): Promise<DocumentActionResult<{ signedUrl: string; filename: string }>> {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required to access documents." };
    }

    const admin = createAdminClient();

    // 2. Query document metadata
    const { data: doc, error: docErr } = await admin
      .from("documents")
      .select("id, storage_path, original_filename, purchase_order_id, uploaded_by")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return { success: false, message: "Document record not found." };
    }

    // 3. Query user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const userRole = profile?.role || "buyer";
    const isAdmin = userRole === "admin";
    const isFinancier = userRole === "financier";

    // 4. Verify user is authorised to view this PO's documents
    if (!isAdmin && !isFinancier && doc.purchase_order_id) {
      const { data: po } = await admin
        .from("purchase_orders")
        .select("buyer_organization_id, supplier_organization_id")
        .eq("id", doc.purchase_order_id)
        .maybeSingle();

      const isBuyer = profile?.organization_id === po?.buyer_organization_id;
      const isSupplier = profile?.organization_id === po?.supplier_organization_id;

      if (!isBuyer && !isSupplier && doc.uploaded_by !== user.id) {
        return {
          success: false,
          message: "Access Denied: You are not authorized to view documents for this transaction.",
        };
      }
    }

    // 5. Generate signed URL (expires in 3600 seconds / 1 hour)
    const { data: signedData, error: signErr } = await admin.storage
      .from("transaction-documents")
      .createSignedUrl(doc.storage_path, 3600, {
        download: download ? doc.original_filename : undefined,
      });

    if (signErr || !signedData?.signedUrl) {
      return {
        success: false,
        message: `Failed to generate secure URL: ${signErr?.message || "Storage error"}`,
      };
    }

    return {
      success: true,
      data: { signedUrl: signedData.signedUrl, filename: doc.original_filename },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to access document.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Authorised Reviewers (Financing Reviewer or Admin) verify or reject documents.
 */
export async function reviewDocumentAction(
  documentId: string,
  newStatus: "verified" | "rejected",
  reason?: string
): Promise<DocumentActionResult<{ status: DocumentVerificationStatus }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const userRole = profile?.role || "buyer";
    const canReview = userRole === "financier" || userRole === "admin";

    if (!canReview) {
      return {
        success: false,
        message: "Unauthorized: Only Financing Reviewers and Administrators can verify or reject trade documents.",
      };
    }

    const admin = createAdminClient();

    // Query document
    const { data: doc, error: docErr } = await admin
      .from("documents")
      .select("id, original_filename, purchase_order_id, verification_status")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return { success: false, message: "Document not found." };
    }

    // Update status in 'documents' table
    const { error: updateErr } = await admin
      .from("documents")
      .update({
        verification_status: newStatus,
      })
      .eq("id", documentId);

    if (updateErr) {
      return { success: false, message: `Failed to update document status: ${updateErr.message}` };
    }

    // Record audit log
    const auditAction = newStatus === "verified" ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED";
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: auditAction,
      entity_table: "documents",
      entity_id: documentId,
      details: {
        purchase_order_id: doc.purchase_order_id,
        original_filename: doc.original_filename,
        previous_status: doc.verification_status,
        new_status: newStatus,
        reason: reason || null,
        reviewed_by: profile?.full_name || user.email,
      },
      created_at: new Date().toISOString(),
    });

    if (doc.purchase_order_id) {
      revalidatePath(`/dashboard/purchase-orders/${doc.purchase_order_id}`);
    }

    return {
      success: true,
      message: `Document '${doc.original_filename}' marked as ${newStatus}.`,
      data: { status: newStatus },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to review document.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Delete a document.
 * Permitted only for the original uploader (while still pending) or an administrator.
 */
export async function deleteDocumentAction(
  documentId: string
): Promise<DocumentActionResult<void>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required." };
    }

    const admin = createAdminClient();

    const { data: doc, error: docErr } = await admin
      .from("documents")
      .select("id, storage_path, original_filename, purchase_order_id, uploaded_by, verification_status")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return { success: false, message: "Document not found." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isUploader = doc.uploaded_by === user.id;
    const isAdmin = profile?.role === "admin";

    if (!isUploader && !isAdmin) {
      return { success: false, message: "Unauthorized to delete this document." };
    }

    // Do not allow deleting verified documents unless admin
    if (doc.verification_status === "verified" && !isAdmin) {
      return {
        success: false,
        message: "Cannot delete a verified document. Please contact an administrator.",
      };
    }

    // Remove from Supabase Storage
    await admin.storage.from("transaction-documents").remove([doc.storage_path]);

    // Delete database record
    await admin.from("documents").delete().eq("id", documentId);

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "DOCUMENT_DELETED",
      entity_table: "documents",
      entity_id: documentId,
      details: {
        purchase_order_id: doc.purchase_order_id,
        original_filename: doc.original_filename,
        storage_path: doc.storage_path,
      },
      created_at: new Date().toISOString(),
    });

    if (doc.purchase_order_id) {
      revalidatePath(`/dashboard/purchase-orders/${doc.purchase_order_id}`);
    }

    return { success: true, message: "Document removed successfully." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete document.";
    return { success: false, message: msg };
  }
}
