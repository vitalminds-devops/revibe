// Every page and every /api call (including the FastAPI backend behind the rewrite) needs a valid session.
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/"))
    return NextResponse.json(
      { detail: "Please sign in again." },
      { status: 401 },
    );
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Public: the login page, Better Auth's own endpoints, static assets and the favicon (app/icon.svg).
  matcher: ["/((?!login|api/auth|_next/static|_next/image|icon.svg).*)"],
};
