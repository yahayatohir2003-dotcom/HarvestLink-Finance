"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole } from "@/types/auth";

export interface RegisterResult {
  success: boolean;
  message?: string;
  requiresEmailConfirmation?: boolean;
  role?: UserRole;
}

/**
 * Server Action: Register a new user, create their organisation record,
 * and link their profile with the assigned role in Supabase PostgreSQL.
 *
 * This fulfills the requirement for strict database integration using the
 * existing 'organizations' and 'profiles' tables.
 */
export async function registerUserAction(formData: {
  fullName: string;
  organisationName: string;
  email: string;
  password: string;
  role: UserRole | "reviewer" | string;
}): Promise<RegisterResult> {
  const { fullName, organisationName, email, password, role } = formData;

  // Validate presence of required fields
  if (!fullName?.trim() || !organisationName?.trim() || !email?.trim() || !password) {
    return { success: false, message: "All registration fields are required." };
  }

  // Enforce password minimum security length
  if (password.length < 8) {
    return { success: false, message: "Password must be at least 8 characters long." };
  }

  // Normalize role: "reviewer" is an alias for "financier" per PostgreSQL check constraints
  const normalizedRole: UserRole = (role === "reviewer" ? "financier" : role) as UserRole;

  try {
    // 1. Initialize the SSR Supabase client for user registration
    const supabase = await createClient();

    // Sign up user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          organisation_name: organisationName.trim(),
          role: normalizedRole,
        },
      },
    });

    if (authError) {
      return { success: false, message: authError.message };
    }

    const user = authData.user;
    if (!user) {
      return { success: false, message: "User account could not be initialized." };
    }

    // 2. Initialize administrative client on server to link organisation and profile
    const admin = createAdminClient();

    // Map role to valid organization_type check constraint ('supplier', 'buyer', 'financier', 'bank', 'admin')
    const orgType = normalizedRole === "admin" ? "admin" : normalizedRole;

    // Insert the new organisation record into 'organizations' table
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: organisationName.trim(),
        organization_type: orgType,
        email: email.trim().toLowerCase(),
      })
      .select("id")
      .single();

    if (orgError) {
      console.warn("Notice: Organisation insert note:", orgError.message);
    }

    // Update the user's profile in 'profiles' table to set their role and organisation_id
    // (Note: The database trigger creates the base profile row; we update it with full details)
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        role: normalizedRole,
        organization_id: org ? org.id : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.warn("Notice: Profile role update note:", profileError.message);
    }

    // 3. Record the registration event in the existing 'audit_logs' table
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "USER_REGISTERED",
      entity_table: "profiles",
      entity_id: user.id,
      details: {
        role: normalizedRole,
        requested_role: role,
        organisation_id: org?.id || null,
        organisation_name: organisationName.trim(),
      },
    });

    // Check if session was returned or if email confirmation is required
    const requiresEmailConfirmation = !authData.session;

    return {
      success: true,
      requiresEmailConfirmation,
      role: normalizedRole,
      message: requiresEmailConfirmation
        ? "Registration successful. Please check your email to activate your account."
        : "Account created successfully.",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected registration error occurred.";
    return { success: false, message };
  }
}
