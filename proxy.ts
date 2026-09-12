import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/login(.*)"]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

function getJwtKid(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[0]) return null;
    const base64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = atob(base64);
    const parsed = JSON.parse(jsonStr);
    return typeof parsed.kid === "string" ? parsed.kid : null;
  } catch {
    return null;
  }
}

// Default Clerk B expected key ID (modest-raptor-18)
const DEFAULT_CLERK_KID_PREFIX = "ins_38xvc79";
// Master Clerk A key ID prefix (neat-oyster-3072)
const MASTER_CLERK_KID_PREFIX = "ins_3I5NHL8";

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const sessionCookie = req.cookies.get("__session")?.value;
  let isMismatched = false;

  if (sessionCookie) {
    const kid = getJwtKid(sessionCookie);
    // If cookie belongs to Master Clerk A or doesn't match Default Clerk B
    if (kid && (kid.startsWith(MASTER_CLERK_KID_PREFIX) || !kid.startsWith(DEFAULT_CLERK_KID_PREFIX))) {
      isMismatched = true;
    }
  }

  if (isMismatched) {
    // Strip foreign Clerk A session cookie before clerkMiddleware sees it to prevent Handshake crash
    const nextHeaders = new Headers(req.headers);
    const cookieHeader = req.headers.get("cookie") || "";
    const filteredCookies = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .filter((c) => !c.startsWith("__session=") && !c.startsWith("__client_uat="))
      .join("; ");

    if (filteredCookies) {
      nextHeaders.set("cookie", filteredCookies);
    } else {
      nextHeaders.delete("cookie");
    }

    const cleanReq = new NextRequest(req.url, {
      headers: nextHeaders,
      method: req.method,
    });

    try {
      const rawRes = await clerkHandler(cleanReq, event);
      const res = rawRes instanceof NextResponse ? rawRes : NextResponse.next();
      res.cookies.delete("__session");
      res.cookies.delete("__client_uat");
      return res;
    } catch {
      const res = NextResponse.redirect(new URL("/sign-in", req.url));
      res.cookies.delete("__session");
      res.cookies.delete("__client_uat");
      return res;
    }
  }

  try {
    return await clerkHandler(req, event);
  } catch (error: any) {
    if (error?.message?.includes("Handshake token verification failed") || error?.message?.includes("jwk-kid-mismatch")) {
      const res = NextResponse.redirect(new URL("/sign-in", req.url));
      res.cookies.delete("__session");
      res.cookies.delete("__client_uat");
      return res;
    }
    throw error;
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|webp|png|jpg|jpeg|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

