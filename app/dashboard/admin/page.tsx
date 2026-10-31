import React from "react";
import { redirect } from "next/navigation";
import {
  LockKeyhole,
  Users2,
  Building2,
  FileText,
  Activity,
  CheckCircle2,
  History,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { AdminAuditRegistryModal, AuditLogEntry } from "@/components/admin/admin-audit-registry-modal";

/**
 * Platform Administrator Workspace
 * Dedicated console for platform operators managing user organisations,
 * reviewing system-wide audit history, and monitoring simulated trade settlements.
 */
export default async function AdminDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/admin");
  }

  // 1. Fetch user's live profile from the 'profiles' database table
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  // Role Access Restriction: Redirect if not an admin
  const userRole = profile?.role || (user.user_metadata?.role as string | undefined) || "admin";
  if (userRole !== "admin") {
    redirect(`/dashboard/${userRole}`);
  }

  // 2. Fetch linked administrative entity details from 'organizations' table
  let orgName = user.user_metadata?.organisation_name || "HarvestLink Operations";
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (org?.name) {
      orgName = org.name;
    }
  }

  const fullName = profile?.full_name || user.user_metadata?.full_name || "Platform Administrator";
  const userEmail = user.email || "";

  // 3. Query total count of registered organisations
  const { count: orgCount } = await supabase
    .from("organizations")
    .select("*", { count: "exact", head: true });

  // 4. Query total count of system audit trail entries
  const { count: auditCount } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact", head: true });

  // 5. Query total simulated settlements recorded
  const { count: settlementCount } = await supabase
    .from("settlements")
    .select("*", { count: "exact", head: true });

  // 6. Query recent audit logs for display and full registry inspection
  const adminClient = createAdminClient();
  const { data: allAudits } = await adminClient
    .from("audit_logs")
    .select("id, actor_id, action, entity_table, entity_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const recentAudits = (allAudits || []).slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role="admin"
        userName={fullName}
        organisationName={orgName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Welcome Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-purple-900 to-slate-900 p-6 sm:p-8 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-800/60 px-2.5 py-1 text-xs font-semibold text-purple-100 border border-purple-500/30">
                <LockKeyhole className="h-3.5 w-3.5" />
                Platform Administration Console
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
                System Overview: {fullName}
              </h1>
              <p className="mt-1 text-sm text-purple-100">
                Administrative Entity: <span className="font-semibold text-white">{orgName}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <AdminAuditRegistryModal
                logs={(allAudits || []) as AuditLogEntry[]}
                totalCount={auditCount || 0}
              />
            </div>
          </div>
        </div>

        {/* System Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Organisations Onboarded</span>
              <Building2 className="h-4 w-4 text-purple-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">{orgCount || 0} Entities</p>
            <span className="mt-1 block text-xs text-slate-500">
              Synchronized from organizations
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Audit Trail Events</span>
              <Activity className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">{auditCount || 0} Logged</p>
            <span className="mt-1 block text-xs text-slate-500">
              audit_logs records
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Storage Bucket Health</span>
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">Connected</p>
            <span className="mt-1 block text-xs text-slate-500 font-mono">
              transaction-documents
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Settlement Records</span>
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">{settlementCount || 0} Recorded</p>
            <span className="mt-1 block text-xs text-slate-500">
              Coordinated settlements
            </span>
          </div>

        </div>

        {/* Recent Audit Activity Snapshot */}
        {recentAudits && recentAudits.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-purple-600" />
              Recent Audit Log Activity
            </h3>
            <div className="divide-y divide-slate-100">
              {recentAudits.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{item.action}</span>
                    <span className="text-slate-400">on</span>
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                      {item.entity_table}
                    </span>
                  </div>
                  <span className="text-slate-400">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Operating Governance Notice */}
        <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-800">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-purple-950">
                Settlement & Regulatory Compliance Protocol
              </h3>
              <p className="text-xs text-purple-900 leading-relaxed">
                In adherence to system safety specifications: HarvestLink Finance does not execute real
                bank wire transfers, debit consumer accounts, or operate an independent payment gateway.
                All settlements are recorded as verified simulated ledger entries between verified trade counterparties.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
