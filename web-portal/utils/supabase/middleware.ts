import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = async (request: NextRequest) => {
  // Start with an unmodified pass-through response.
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Avoid crashing edge middleware when env vars are missing in deployment.
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        } catch {
          // Request cookies can be immutable in some runtimes.
        }

        supabaseResponse = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Trigger token refresh/update and ensure cookie hooks run in middleware.
  await supabase.auth.getUser();

  return supabaseResponse;
};
