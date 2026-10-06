// Runs in front of every page and API request (Next.js "proxy", formerly middleware).
// It does two security jobs:
//   1. Redirects plain HTTP to HTTPS when deployed behind a proxy.
//   2. Attaches security headers, including a strict Content Security Policy
//      with a fresh nonce per request, so injected scripts cannot run.

import { NextResponse, type NextRequest } from "next/server";

const IS_DEV = process.env.NODE_ENV === "development";
/** True when a host or reverse proxy terminates TLS in front of the app. */
const BEHIND_HTTPS_PROXY = !!process.env.VERCEL || process.env.FOODLINK_TRUST_PROXY === "1";

/** Map tiles are the only third-party resource the app ever loads. */
const TILE_HOST = "https://tile.openstreetmap.org";

function contentSecurityPolicy(nonce: string): string {
  const directives = [
    "default-src 'self'",
    // Only scripts carrying this request's nonce may run. No inline scripts, no eval in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? " 'unsafe-eval'" : ""}`,
    // Style attributes are allowed because the map library positions tiles with them.
    // Stylesheets themselves must come from this site or carry the nonce.
    IS_DEV ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${TILE_HOST}`,
    "font-src 'self'",
    `connect-src 'self'${IS_DEV ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ];
  if (BEHIND_HTTPS_PROXY) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

function applyBaseHeaders(response: NextResponse): void {
  const h = response.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  // Never tell another site (maps, an organizer's website) which listing the resident was viewing.
  h.set("Referrer-Policy", "no-referrer");
  // Location may be requested by FoodLink itself and by nothing embedded in it.
  h.set("Permissions-Policy", "geolocation=(self), camera=(), microphone=(), payment=(), usb=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("X-DNS-Prefetch-Control", "off");
  if (BEHIND_HTTPS_PROXY) {
    h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
}

export function proxy(request: NextRequest): NextResponse {
  // HTTPS everywhere.
  if (BEHIND_HTTPS_PROXY && request.headers.get("x-forwarded-proto") === "http") {
    const url = new URL(request.url);
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // API responses are JSON: they need the base headers and a lock-down CSP, but no nonce.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    applyBaseHeaders(response);
    response.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    return response;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  // Next.js reads the nonce from this request header and stamps it on its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applyBaseHeaders(response);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except static build assets and image files.
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp|woff2)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
