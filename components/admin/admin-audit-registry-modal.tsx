"use client";

import React, { useState, useMemo } from "react";
import {
  History,
  X,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  details: unknown;
  created_at: string;
}

interface AdminAuditRegistryModalProps {
  logs: AuditLogEntry[];
  totalCount: number;
}

export function AdminAuditRegistryModal({ logs, totalCount }: AdminAuditRegistryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filter logs by search term and entity_table
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedTable !== "all" && log.entity_table !== selectedTable) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesAction = log.action.toLowerCase().includes(term);
        const matchesTable = log.entity_table.toLowerCase().includes(term);
        const matchesId = log.entity_id ? log.entity_id.toLowerCase().includes(term) : false;
        return matchesAction || matchesTable || matchesId;
      }
      return true;
    });
  }, [logs, selectedTable, searchTerm]);

  const tables = useMemo(() => {
    const set = new Set(logs.map((l) => l.entity_table).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [logs]);

  return (
    <>
      {/* Trigger Button - Functional & Accessible */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-purple-950 shadow hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors"
        title="View platform audit log trail"
        aria-haspopup="dialog"
      >
        <History className="h-4 w-4 text-purple-800" />
        <span>Audit Trail Registry</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4 bg-purple-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-700 text-white shadow-sm">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Platform Audit Trail Registry
                  </h3>
                  <p className="text-xs text-slate-500">
                    Immutable security log: {totalCount} total events recorded in database
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Controls Bar: Search & Table Filter */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by action or table..."
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 pl-10 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {tables.map((tbl) => (
                  <button
                    key={tbl}
                    type="button"
                    onClick={() => setSelectedTable(tbl)}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedTable === tbl
                        ? "bg-purple-800 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {tbl === "all" ? "All Tables" : tbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit Logs List View (Desktop Table + Mobile Cards) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="font-semibold text-slate-700">No matching audit log entries found</p>
                  <p>Try clearing your search query or table filter.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const hasDetails = Boolean(
                      log.details && typeof log.details === "object" && Object.keys(log.details).length > 0
                    );

                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 text-xs hover:border-purple-300 transition-colors space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {log.action}
                            </span>
                            <span className="font-mono bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                              {log.entity_table}
                            </span>
                            {log.entity_id && (
                              <span className="font-mono text-slate-400 text-[10px] hidden sm:inline">
                                #{log.entity_id.slice(0, 8)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 text-slate-400 text-[11px]">
                            <span>{new Date(log.created_at).toLocaleString("en-NG")}</span>
                            {hasDetails && (
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className="min-h-[32px] inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-semibold"
                              >
                                {isExpanded ? (
                                  <>
                                    <span>Hide</span>
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </>
                                ) : (
                                  <>
                                    <span>Inspect</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded JSON details inspection */}
                        {isExpanded && hasDetails && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <div className="rounded-lg bg-slate-900 text-slate-100 p-3 text-[11px] font-mono overflow-x-auto">
                              <pre>{JSON.stringify(log.details, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 px-5 sm:px-6 py-3.5 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Showing {filteredLogs.length} of {logs.length} loaded records
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close Registry
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
