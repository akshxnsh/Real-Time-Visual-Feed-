import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  // Authenticated user with no onboarding cookie → send to /onboard
  if (
    session?.user &&
    !req.cookies.get("rtvf_onboarded") &&
    nextUrl.pathname !== "/onboard"
  ) {
    return NextResponse.redirect(new URL("/onboard", nextUrl));
  }
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth (auth pages)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|auth).*)",
  ],
};