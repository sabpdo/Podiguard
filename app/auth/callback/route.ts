import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL("/login?error=configuration", requestUrl.origin));
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          );
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${error.message}`, requestUrl.origin));
    }

    // Get user to check role
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const userRole = user.user_metadata?.role || "patient";
      
      // Check if user has agreed to privacy policy
      const { data: profile } = await supabase
        .from("profiles")
        .select("privacy_agreed")
        .eq("id", user.id)
        .single();

      if (userRole === "clinician") {
        // Redirect clinicians to registration page
        return NextResponse.redirect(new URL("/clinician/register", requestUrl.origin));
      } else if (profile?.privacy_agreed) {
        // If patient has already agreed to privacy, go to dashboard
        return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
      } else {
        // New patient needs to accept privacy agreement
        return NextResponse.redirect(new URL("/privacy-agreement", requestUrl.origin));
      }
    }
  }

  // Fallback redirect
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
