import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js Edge Middleware entry point.
 * Intercepts requests to refresh Supabase authentication tokens and
 * safeguard protected dashboard routes.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

/**
 * Matcher configuration:
 * Run middleware on all application routes except:
 * - _next/static (static asset chunks)
 * - _next/image (image optimization files)
 * - favicon.ico (browser icon)
 * - Static file extensions (.svg, .png, .jpg, .jpeg, .gif, .webp)
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
