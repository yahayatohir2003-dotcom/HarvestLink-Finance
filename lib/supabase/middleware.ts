import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Updates the user's authentication session token on every incoming request.
 * Required by @supabase/ssr to ensure that expiring JWTs are refreshed before
 * rendering protected pages and that session cookies stay synchronized.
 *
 * @param request - NextRequest object for the current route
 * @returns NextResponse object with updated cookies and routing logic
 */
export async function updateSession(request: NextRequest) {
  // Initialize the response with the incoming request headers
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Extract public credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If environment variables are not yet configured, pass through safely
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // Create an SSR client bound to the request and response cookie streams
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        // Read all available cookies from the incoming Next.js request
        getAll() {
          return request.cookies.getAll();
        },
        // Synchronize updated cookies across both request and response objects
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Mutate the request cookies so downstream route handlers receive refreshed values
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          // Mutate the response cookies so the browser updates its cookie jar
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate the current user session (getUser performs a secure server-side JWT verification)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protect all /dashboard routes from unauthorized access
  if (pathname.startsWith("/dashboard") && !user) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the original destination for redirection post-authentication
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If an authenticated user attempts to access /login or /register, redirect them to the dashboard
  if ((pathname === "/login" || pathname === "/register") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
