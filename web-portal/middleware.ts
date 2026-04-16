import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "./utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    return await createClient(request);
  } catch (error) {
    console.error("Middleware session refresh failed:", error);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
