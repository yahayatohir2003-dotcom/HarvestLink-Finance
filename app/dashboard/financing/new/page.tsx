import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Coins, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard-header";
import { FinancingRequestForm } from "@/components/financing/financing-request-form";
import { getEligiblePurchaseOrdersAction } from "../actions";
import { UserRole } from "@/types/auth";

interface NewFinancingPageProps {
  searchParams: {
    po?: string;
  };
}

export default async function NewFinancingPage({
  searchParams,
}: NewFinancingPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/financing/new");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile?.role || "supplier") as UserRole;

  if (userRole !== "supplier" && userRole !== "admin") {
    redirect("/dashboard/financing");
  }

  // Fetch eligible orders
  const eligibleRes = await getEligiblePurchaseOrdersAction();
  const eligibleOrders = eligibleRes.success && eligibleRes.data ? eligibleRes.data : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={profile?.full_name || user.email}
        userEmail={user.email}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Back link */}
        <Link
          href="/dashboard/financing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Financing Applications
        </Link>

        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-md">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Apply for Purchase Order Financing
            </h1>
            <p className="text-xs text-slate-500">
              Submit your confirmed corporate purchase order for institutional working capital review.
            </p>
          </div>
        </div>

        {/* Application Form */}
        <FinancingRequestForm
          eligibleOrders={eligibleOrders}
          preselectedPoId={searchParams?.po}
        />

        {/* Compliance Footer Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-slate-800">
              HarvestLink Financing Coordination Policy
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Financing requests are reviewed independently by accredited institutional lenders and credit partners.
              Approval terms depend on buyer credit rating, commodity perishability, and verified delivery records.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
