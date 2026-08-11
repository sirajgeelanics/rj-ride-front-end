import { type NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://192.168.1.39:8000";

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
