"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sprout, Lock, Mail, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Inner login form component utilizing useSearchParams.
 * Wrapped in a React Suspense boundary below to conform with Next.js App Router requirements.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Redirect destination if specified in query string (e.g. from middleware or session expiration)
  const redirectPath = searchParams.get("redirect");

  // Form input state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Handles user submission for email/password authentication
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    // Basic client-side validation
    if (!email.trim() || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setIsLoading(true);

    try {
      // Instantiate the browser Supabase client
      const supabase = createClient();

      // Attempt authentication with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      // If successful, determine destination based on live database profile
      if (data?.user) {
        // Query the live PostgreSQL 'profiles' table for the verified user role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        // Fall back to user_metadata or default to supplier if profile is pending
        const userRole = profile?.role || (data.user.user_metadata?.role as string | undefined) || "supplier";

        // If a specific redirect was requested and is safe, honor it
        if (redirectPath && redirectPath.startsWith("/dashboard")) {
          router.push(redirectPath);
          return;
        }

        // Route to the appropriate role-based workspace
        switch (userRole) {
          case "supplier":
            router.push("/dashboard/supplier");
            break;
          case "buyer":
            router.push("/dashboard/buyer");
            break;
          case "financier":
          case "reviewer":
            router.push("/dashboard/financier");
            break;
          case "admin":
            router.push("/dashboard/admin");
            break;
          default:
            router.push("/dashboard");
            break;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred during sign in.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-white p-5 sm:p-10 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
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
          Sign in to your portal
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          Access your agricultural trade finance dashboard and operations
        </p>
      </div>

      {/* Error Notification Alert */}
      {errorMessage && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Login Form */}
      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>

        {/* Email Address Input */}
        <div>
          <label htmlFor="email-address" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Work Email Address
          </label>
          <div className="relative rounded-lg shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Mail className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organisation.com"
              className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-brand-700 hover:text-brand-900"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative rounded-lg shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
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
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In to Account</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Link to Registration */}
      <div className="pt-4 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-600">
          Don&apos;t have an organisation account yet?{" "}
          <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-900">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * HarvestLink Finance - Sign In Page Entry Point
 * Wraps LoginForm in a Suspense boundary to satisfy Next.js CSR bailout requirements for useSearchParams.
 */
export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-8 sm:py-12 px-3 sm:px-6 lg:px-8 bg-slate-50">
      <Suspense
        fallback={
          <div className="max-w-md w-full bg-white p-12 rounded-2xl border border-slate-200 text-center shadow">
            <Loader2 className="h-8 w-8 animate-spin text-brand-700 mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading authentication portal...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
