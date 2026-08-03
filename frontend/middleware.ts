import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * DugsiPro — Multi-Tenant Subdomain Middleware
 *
 * Extracts the subdomain from the incoming hostname and rewrites the request
 * internally to /school/[subdomain][pathname] so the tenant portal page is served
 * without changing the URL visible in the browser.
 *
 * Root domains that are treated as the "main" site (no rewrite applied):
 *   - dugsipro.so
 *   - www.dugsipro.so
 *   - localhost:3000   (or localhost without port)
 *   - 127.0.0.1        (and with port)
 *
 * Paths that are always passed through regardless of subdomain:
 *   - /_next/*         (Next.js internals / static assets)
 *   - /api/*           (API routes)
 *   - /favicon.ico
 *   - /school/*        (already rewritten — prevents infinite loops)
 *   - /login           (login page, subdomain is passed as query param separately)
 *   - /[shortcode]/*   (existing shortcode portal — keep working)
 */

/** All root hostnames that map to the main DugsiPro landing page. */
const ROOT_DOMAINS = new Set([
  'dugsipro.so',
  'www.dugsipro.so',
  'localhost',
  'localhost:3000',
  '127.0.0.1',
  '127.0.0.1:3000',
]);

/** Path prefixes/files that must never be rewritten. */
const BYPASS_PREFIXES = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/school',   // prevents rewrite loop
  '/login',
  '/_error',
  '/404',
  '/500',
];

/**
 * Extract the subdomain from a given hostname.
 * Returns null if the hostname is a root domain or an IP address.
 *
 * Examples:
 *   "xamdaan.dugsipro.so"   → "xamdaan"
 *   "xamdaan.localhost:3000" → "xamdaan"
 *   "dugsipro.so"           → null
 *   "localhost:3000"        → null
 *   "192.168.1.1"           → null
 */
function extractSubdomain(hostname: string): string | null {
  // Strip port from hostname for comparison purposes
  const hostWithoutPort = hostname.split(':')[0];

  // Return null for IP addresses (v4 only — v6 is unusual for web)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostWithoutPort)) return null;

  // Return null for exact root domain matches
  if (ROOT_DOMAINS.has(hostname) || ROOT_DOMAINS.has(hostWithoutPort)) return null;

  // Check for subdomain.localhost pattern (local dev)
  const localhostMatch = hostname.match(/^([a-z0-9-]+)\.localhost(:\d+)?$/i);
  if (localhostMatch) return localhostMatch[1].toLowerCase();

  // Check for subdomain.dugsipro.so pattern (production)
  const productionMatch = hostname.match(/^([a-z0-9-]+)\.dugsipro\.so$/i);
  if (productionMatch) return productionMatch[1].toLowerCase();

  return null;
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // Always pass through asset/API/internal paths
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const subdomain = extractSubdomain(hostname);

  // No subdomain → main landing page, pass through normally
  if (!subdomain) {
    return NextResponse.next();
  }

  // ── Tenant subdomain detected ─────────────────────────────────────────────
  // Rewrite internally to /school/[subdomain][pathname]
  // The browser URL stays as subdomain.dugsipro.so/...
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/school/${subdomain}${pathname === '/' ? '' : pathname}`;

  // Preserve any existing query params
  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  /*
   * Match all paths except Next.js internal paths and static files.
   * Using a negative lookahead to keep the matcher lightweight.
   */
  matcher: [
    /*
     * Match everything EXCEPT:
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     *  - Files with extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|otf|css|js|map)).*)',
  ],
};
