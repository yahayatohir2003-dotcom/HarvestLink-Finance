import React from "react";
import Link from "next/link";
import {
  Sprout,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  FileCheck2,
  Truck,
  Building2,
  Users2,
  Scale,
  LockKeyhole,
  CheckCircle2,
  Warehouse,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";

/**
 * HarvestLink Finance - Public Landing Page
 * Demonstrates the end-to-end Nigerian agricultural supply-chain finance workflow,
 * presenting distinct portals for Suppliers, Buyers, Financing Reviewers, and Administrators.
 */
export default function HomePage() {
  return (
    <div className="flex flex-col">

      {/* =====================================================================
          1. HERO SECTION
          ===================================================================== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/60 via-white to-slate-50 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">

            {/* National Ecosystem Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
              Nigerian Agri-Supply Chain Finance Infrastructure
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-tight">
              Unlock Working Capital for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-700 to-brand-500">
                Agricultural Purchase Orders
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg leading-relaxed text-slate-600 sm:text-xl">
              HarvestLink Finance connects Nigerian produce aggregators, food processors,
              and institutional lenders through transparent milestone tracking, verified transaction documents,
              and risk-mitigated supply-chain financing.
            </p>

            {/* Demonstration & Non-Custodial Disclosure Banner */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-900 max-w-2xl text-center shadow-xs">
              <span className="font-bold">Demonstration Platform:</span> HarvestLink coordinates supply-chain documentation and transaction milestones. It does not extend credit, hold customer balances, or process real bank transfers. All transaction workflows and commodity presets (such as maize) are illustrative models for platform demonstration.
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pt-2">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-700/25 hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 transition-all hover:-translate-y-0.5"
              >
                Register Your Organisation
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-base font-semibold text-slate-800 shadow-sm hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all"
              >
                Sign In to Portal
              </Link>
            </div>

            {/* Trust highlights */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Supabase Row Level Security</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Audited Milestone Verification</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Multi-Party Trade Reconciliation</span>
              </div>
            </div>
          </div>

          {/* Key Platform Capabilities Snapshot (id="features" for navigation anchor) */}
          <div id="features" className="mt-16 scroll-mt-24 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Multi-Tenant Isolation</span>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">100% RLS</p>
              <span className="mt-1 block text-xs text-brand-700 font-medium">PostgreSQL Row Level Security</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Operating Roles</span>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">4 Portals</p>
              <span className="mt-1 block text-xs text-slate-500 font-medium">Supplier, Buyer, Reviewer, Admin</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Document Security</span>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Private Vault</p>
              <span className="mt-1 block text-xs text-slate-500 font-medium">Signed URLs & verification reviews</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Custodial Exposure</span>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700">₦0 Deposits</p>
              <span className="mt-1 block text-xs text-emerald-600 font-medium">Non-custodial trade coordination</span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. USER ROLES & PORTALS
          ===================================================================== */}
      <section id="roles" className="py-20 bg-white border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Role-Based Access Control</span>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Engineered for Every Trade Participant
            </h2>
            <p className="mt-4 text-base text-slate-600">
              Each stakeholder accesses a purpose-built workspace protected by strict database-level security policies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

            {/* Role 1: Supplier */}
            <div className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-6 hover:bg-white hover:border-emerald-300 hover:shadow-lg transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mb-5 group-hover:scale-110 transition-transform">
                <Sprout className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">1. Suppliers & Aggregators</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Produce aggregators, farmer cooperatives, and commodity traders requiring upfront working capital.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Receive and accept buyer POs</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Submit financing requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Upload waybills & milestone receipts</span>
                </li>
              </ul>
              <Link
                href="/register?role=supplier"
                className="mt-6 inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Register as Supplier →
              </Link>
            </div>

            {/* Role 2: Buyer */}
            <div className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-6 hover:bg-white hover:border-amber-300 hover:shadow-lg transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 mb-5 group-hover:scale-110 transition-transform">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">2. Corporate Buyers</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Grain millers, FMCGs, food processors, and exporters procuring agricultural commodities.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Issue structured purchase orders</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Monitor live fulfillment milestones</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Digital delivery confirmation & invoicing</span>
                </li>
              </ul>
              <Link
                href="/register?role=buyer"
                className="mt-6 inline-flex items-center text-xs font-semibold text-amber-800 hover:text-amber-950"
              >
                Register as Buyer →
              </Link>
            </div>

            {/* Role 3: Financing Reviewer */}
            <div className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-6 hover:bg-white hover:border-blue-300 hover:shadow-lg transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 mb-5 group-hover:scale-110 transition-transform">
                <Scale className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">3. Financing Reviewers</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Institutional lenders, credit underwriters, and risk managers reviewing PO financing applications.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Inspect transaction documents</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Perform credit risk assessment</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Approve / reject facility terms</span>
                </li>
              </ul>
              <Link
                href="/register?role=reviewer"
                className="mt-6 inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Access Reviewer Desk →
              </Link>
            </div>

            {/* Role 4: Platform Administrator */}
            <div className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-6 hover:bg-white hover:border-purple-300 hover:shadow-lg transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 mb-5 group-hover:scale-110 transition-transform">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">4. Platform Administrators</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                System stewards overseeing operational integrity, user verification, and platform-wide audit trails.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>Verify organisation credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>Review immutable audit history</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>Monitor simulated settlements</span>
                </li>
              </ul>
              <Link
                href="/login?role=admin"
                className="mt-6 inline-flex items-center text-xs font-semibold text-purple-700 hover:text-purple-900"
              >
                Admin Sign In →
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================================
          3. HOW IT WORKS / TRANSACTION WORKFLOW
          ===================================================================== */}
      <section id="how-it-works" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Workflow Pipeline</span>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              From Purchase Order to Settlement
            </h2>
            <p className="mt-4 text-base text-slate-600">
              A verifiable 4-stage lifecycle ensuring transparency, mitigating fraud, and securing working capital.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

            <div className="relative rounded-2xl bg-white p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-800 text-sm font-bold mb-4">
                  01
                </span>
                <h4 className="text-base font-bold text-slate-900">PO Issuance & Items</h4>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  The Buyer creates a verified purchase order specifying commodity specifications, metric tonnage, agreed prices, and delivery warehouses.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-brand-700 font-medium">
                <FileSpreadsheet className="h-4 w-4" />
                Line Item Cataloging
              </div>
            </div>

            <div className="relative rounded-2xl bg-white p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-800 text-sm font-bold mb-4">
                  02
                </span>
                <h4 className="text-base font-bold text-slate-900">Financing Review</h4>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  The Supplier applies for facility disbursement against the active PO. The Financing Reviewer verifies documents and approves facility terms.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-brand-700 font-medium">
                <Scale className="h-4 w-4" />
                Underwriting & Terms
              </div>
            </div>

            <div className="relative rounded-2xl bg-white p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-800 text-sm font-bold mb-4">
                  03
                </span>
                <h4 className="text-base font-bold text-slate-900">Milestone Fulfilment</h4>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Supplier logs progress (bagging, truck loading, transit, weighbridge) and uploads verified documents into the secure storage bucket.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-brand-700 font-medium">
                <Truck className="h-4 w-4" />
                `transaction-documents`
              </div>
            </div>

            <div className="relative rounded-2xl bg-white p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-800 text-sm font-bold mb-4">
                  04
                </span>
                <h4 className="text-base font-bold text-slate-900">Delivery & Settlement</h4>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Buyer confirms physical delivery at the receiving warehouse. An invoice is matched and a simulated settlement transaction is recorded.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-brand-700 font-medium">
                <Receipt className="h-4 w-4" />
                Reconciled Ledger
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================================
          4. SECURITY & ARCHITECTURE PILLAR
          ===================================================================== */}
      <section id="security" className="py-20 bg-white border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-900 p-8 sm:p-12 lg:p-16 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10 max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-lg bg-brand-900/80 px-3 py-1 text-xs font-semibold text-brand-300 border border-brand-700/50 mb-6">
                <ShieldCheck className="h-4 w-4" />
                Enterprise Security Architecture
              </span>
              <h2 className="text-3xl font-extrabold sm:text-4xl leading-tight">
                Built on Supabase PostgreSQL with Strict Row Level Security
              </h2>
              <p className="mt-4 text-base text-slate-300 leading-relaxed">
                HarvestLink Finance enforces multi-tenant isolation directly inside the database layer.
                Agribusinesses only ever see their own records. All documents are stored in private
                Supabase Storage buckets and signed audit trails trace every stage modification.
              </p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-brand-400"></div>
                  <span>Strict Row Level Security (RLS) policies</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-brand-400"></div>
                  <span>Secure server-side token verification</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-brand-400"></div>
                  <span>Protected document vault (`transaction-documents`)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-brand-400"></div>
                  <span>Simulated ledger compliance controls</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. BOTTOM CALL TO ACTION
          ===================================================================== */}
      <section className="py-20 bg-brand-900 text-white text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to Finance Your Next Agricultural Purchase Order?
          </h2>
          <p className="text-base text-brand-100 max-w-2xl mx-auto">
            Join suppliers, commercial buyers, and financial institutions across Nigeria.
            Register your organisation today to get started.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="rounded-xl bg-white px-8 py-3.5 text-base font-bold text-brand-900 shadow hover:bg-brand-50 transition-colors"
            >
              Register Organisation
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-brand-400/50 px-8 py-3.5 text-base font-bold text-white hover:bg-brand-800 transition-colors"
            >
              Sign In to Account
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
