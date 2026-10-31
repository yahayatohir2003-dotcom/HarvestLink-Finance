"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sprout,
  Building2,
  Scale,
  Mail,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UserRole } from "@/types/auth";
import { registerUserAction } from "./actions";

/**
 * Inner Registration Form component utilizing useSearchParams.
 * Wrapped in a React Suspense boundary below.
 */
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read preselected role from query parameters (e.g. ?role=buyer or ?role=reviewer)
  const roleParam = searchParams.get("role");
  const initialRole: UserRole =
    roleParam === "buyer"
      ? "buyer"
      : roleParam === "reviewer" || roleParam === "financier"
      ? "financier"
      : "supplier";

  // Form input state
  const [fullName, setFullName] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * Handles user submission for registration
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    // Validation checks
    if (!fullName.trim() || !organisationName.trim() || !email.trim() || !password) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters in length.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsLoading(true);

    try {
      // Invoke the server action which creates the auth account, inserts into organizations, and links profiles
      const result = await registerUserAction({
        fullName: fullName.trim(),
        organisationName: organisationName.trim(),
        email: email.trim(),
        password,
        role: selectedRole,
      });

      if (!result.success) {
        setErrorMessage(result.message || "Registration failed. Please try again.");
        setIsLoading(false);
        return;
      }

      if (result.requiresEmailConfirmation) {
        // If email confirmation is required, show the confirmation screen
        setIsSuccess(true);
      } else {
        // Redirect to the designated role workspace
        router.push(`/dashboard/${selectedRole}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred during registration.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }

  // Display confirmation banner if registration requires email verification
  if (isSuccess) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-xl text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Registration Successful</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            We have dispatched an activation confirmation link to{" "}
            <span className="font-semibold text-slate-900">{email}</span>.
            Please verify your email to activate your {selectedRole} account.
          </p>
          <div className="pt-4 border-t border-slate-100">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 transition-colors"
            >
              Proceed to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-8 sm:py-12 px-3 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-xl w-full space-y-6 sm:space-y-8 bg-white p-5 sm:p-10 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">

        {/* Header Branding */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm">
              <Sprout className="h-6 w-6 text-emerald-100" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              HarvestLink<span className="text-brand-600">.</span>Finance
            </span>
          </Link>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Register your organisation
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Select your trading role and create your enterprise supply-chain account
          </p>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-200 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Registration Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>

          {/* Role Selection Segment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
              Select Your Role in the Supply Chain
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* Supplier Option */}
              <button
                type="button"
                onClick={() => setSelectedRole("supplier")}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  selectedRole === "supplier"
                    ? "border-brand-600 bg-brand-50/70 ring-2 ring-brand-600/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Sprout className={`h-5 w-5 ${selectedRole === "supplier" ? "text-brand-700" : "text-slate-500"}`} />
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    selectedRole === "supplier" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    Supplier
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900">Produce Aggregator</span>
                <span className="text-[11px] text-slate-500 mt-0.5">PO financing & shipment</span>
              </button>

              {/* Buyer Option */}
              <button
                type="button"
                onClick={() => setSelectedRole("buyer")}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  selectedRole === "buyer"
                    ? "border-amber-600 bg-amber-50/70 ring-2 ring-amber-600/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Building2 className={`h-5 w-5 ${selectedRole === "buyer" ? "text-amber-700" : "text-slate-500"}`} />
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    selectedRole === "buyer" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    Buyer
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900">Processor / FMCG</span>
                <span className="text-[11px] text-slate-500 mt-0.5">Issue POs & verify goods</span>
              </button>

              {/* Financing Reviewer Option */}
              <button
                type="button"
                onClick={() => setSelectedRole("financier")}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  selectedRole === "financier"
                    ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Scale className={`h-5 w-5 ${selectedRole === "financier" ? "text-blue-700" : "text-slate-500"}`} />
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    selectedRole === "financier" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    Reviewer
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900">Financing Partner</span>
                <span className="text-[11px] text-slate-500 mt-0.5">Credit review & facilities</span>
              </button>

            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Full Name */}
            <div>
              <label htmlFor="full-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Contact Person Name
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aliko Danjuma"
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </div>
            </div>

            {/* Organisation Name */}
            <div>
              <label htmlFor="org-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Registered Agribusiness / Firm
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Building2 className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="org-name"
                  type="text"
                  required
                  value={organisationName}
                  onChange={(e) => setOrganisationName(e.target.value)}
                  placeholder="e.g. Kano Grains Ltd"
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </div>
            </div>

          </div>

          {/* Email Address */}
          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Official Work Email
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trade@organisation.com"
                className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password (min 8 chars)
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </div>
            </div>

          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Sign In Link */}
        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-600">
            Already have an active account?{" "}
            <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-900">
              Sign in here
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}

/**
 * HarvestLink Finance - Registration Page Entry Point
 * Wraps RegisterForm in a Suspense boundary to satisfy Next.js CSR bailout requirements for useSearchParams.
 */
export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
          <div className="max-w-xl w-full bg-white p-12 rounded-2xl border border-slate-200 text-center shadow">
            <Loader2 className="h-8 w-8 animate-spin text-brand-700 mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading registration portal...</p>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
