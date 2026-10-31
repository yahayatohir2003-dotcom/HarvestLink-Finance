"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
  CheckCircle2,
  AlertOctagon,
  Calendar,
  User,
  Scale,
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  PlusCircle,
  FileCheck2,
} from "lucide-react";
import {
  EnrichedDeliveryConfirmation,
  DeliveryConfirmationRecord,
} from "@/types/fulfilment";
import { DocumentRecord } from "@/types/document";
import { DeliveryStatusBadge } from "./delivery-status-badge";
import { DeliveryConfirmationModal } from "./delivery-confirmation-modal";
import { getDocumentSignedUrlAction } from "@/app/dashboard/purchase-orders/[id]/document-actions";

interface DeliveryConfirmationCardProps {
  purchaseOrderId: string;
  orderReference: string;
  orderStatus: string;
  totalOrderedQuantity?: number;
  confirmations: EnrichedDeliveryConfirmation[];
  availableDocuments: DocumentRecord[];
  canConfirmDelivery: boolean; // Buyer or Admin
}

export function DeliveryConfirmationCard({
  purchaseOrderId,
  orderReference,
  orderStatus,
  totalOrderedQuantity,
  confirmations,
  availableDocuments,
  canConfirmDelivery,
}: DeliveryConfirmationCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const isConfirmed = confirmations.some((c) => c.status === "confirmed");
  const canRecordDelivery = canConfirmDelivery && (orderStatus === "accepted" || (!isConfirmed && orderStatus === "fulfilled"));

  const handleDownloadEvidence = async (documentId: string) => {
    setDownloadingDocId(documentId);
    try {
      const res = await getDocumentSignedUrlAction(documentId);
      if (res.success && res.data?.signedUrl) {
        window.open(res.data.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        alert(res.message || "Failed to retrieve evidence document.");
      }
    } catch {
      alert("Error retrieving document.");
    } finally {
      setDownloadingDocId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white shadow-xs">
            <Truck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Delivery Intake & Confirmation Desk
            </h3>
            <p className="text-xs text-slate-500">
              Buyer warehouse receipt inspection and formal trade confirmation
            </p>
          </div>
        </div>

        {canRecordDelivery && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition-all shrink-0"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Record Delivery Receipt</span>
          </button>
        )}
      </div>

      {/* Confirmation Records or Empty State */}
      {confirmations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
          <Truck className="mx-auto h-8 w-8 text-slate-400" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-700">No delivery receipt recorded yet</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              {canConfirmDelivery
                ? "When physical commodity consignments arrive at your offloading silo or warehouse, inspect the shipment and record delivery intake confirmation."
                : "Awaiting physical arrival at buyer facility and formal intake confirmation by the buyer."}
            </p>
          </div>
          {canRecordDelivery && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
              <span>Record Delivery Receipt</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {confirmations.map((conf) => {
            const isConfirmedStatus = conf.status === "confirmed";
            const isDisputed = conf.status === "disputed";

            return (
              <div
                key={conf.id}
                className={`rounded-xl border p-5 space-y-4 transition-all ${
                  isConfirmedStatus
                    ? "border-emerald-200 bg-emerald-50/30"
                    : isDisputed
                    ? "border-rose-200 bg-rose-50/30"
                    : "border-slate-200 bg-slate-50/50"
                }`}
              >
                {/* Top Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <DeliveryStatusBadge status={conf.status} size="md" />
                    <span className="font-mono text-xs text-slate-400">
                      Record #{conf.id.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Delivered: {new Date(conf.delivery_date).toLocaleString("en-GB")}</span>
                  </div>
                </div>

                {/* Grid Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white p-3 border border-slate-200/80 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Receiving Officer
                    </span>
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-500" />
                      {conf.received_by_name || "Warehouse Manager"}
                    </p>
                    {conf.confirmerProfile && (
                      <p className="text-[10px] text-slate-500">
                        Auth User: {conf.confirmerProfile.full_name}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg bg-white p-3 border border-slate-200/80 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Quantity Received
                    </span>
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-mono">
                      <Scale className="h-3.5 w-3.5 text-slate-500" />
                      {conf.quantity_received !== null
                        ? conf.quantity_received.toLocaleString()
                        : "Not specified"}
                      {totalOrderedQuantity && (
                        <span className="text-[10px] font-normal text-slate-500 font-sans">
                          (of {totalOrderedQuantity.toLocaleString()})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-3 border border-slate-200/80 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Evidence Document
                    </span>
                    {conf.evidenceDocument ? (
                      <button
                        type="button"
                        onClick={() => handleDownloadEvidence(conf.evidenceDocument!.id)}
                        disabled={downloadingDocId === conf.evidenceDocument.id}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[120px]">
                          {conf.evidenceDocument.original_filename}
                        </span>
                        <Download className="h-3 w-3 shrink-0" />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">None attached</span>
                    )}
                  </div>
                </div>

                {/* Condition Notes */}
                {conf.condition_notes && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Intake Remarks & Condition Inspection
                    </span>
                    <div className="rounded-lg bg-white p-3 border border-slate-200/80 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {conf.condition_notes}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Platform Governance Notice */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-[11px] text-slate-600 leading-relaxed">
        <span className="font-bold text-slate-800">Platform Governance Notice:</span> HarvestLink Finance coordinates documentation and trade settlement data. HarvestLink does not physically transport goods, provide logistics haulage, or independently certify warehouse delivery.
      </div>

      {/* Delivery Confirmation Modal */}
      <DeliveryConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        purchaseOrderId={purchaseOrderId}
        orderReference={orderReference}
        totalOrderedQuantity={totalOrderedQuantity}
        availableDocuments={availableDocuments}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
