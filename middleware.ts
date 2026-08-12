import { type NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.API_ORIGIN ?? "https://api-ravani.rezolv.app";

// Proxy /api/* to the Django backend, preserving the trailing slash the API client
// sends. A next.config `rewrites` entry drops the trailing slash (Django then 301-loops
// re-adding it), so we rewrite here explicitly instead. Mirrors ride_prd/middleware.ts.
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const normalised = pathname.endsWith("/") ? pathname : `${pathname}/`;
    const target = `${API_ORIGIN}${normalised}${search}`;
    return NextResponse.rewrite(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
