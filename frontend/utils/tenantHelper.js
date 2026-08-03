/**
 * tenantHelper.js
 *
 * Client-safe utility for resolving a subdomain to a DugsiPro school/tenant.
 *
 * Uses the existing backend endpoint:
 *   GET /api/schools/by-code/:code
 *
 * The subdomain is treated as the school's shortCode (case-normalised to
 * uppercase before the request is made, matching the existing DB convention).
 *
 * Usage:
 *   import { getSchoolBySubdomain } from '../utils/tenantHelper'
 *   const school = await getSchoolBySubdomain('xamdaan')
 *   // → { id, name, logo, shortCode, type, isActive, schools? } | null
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

/**
 * @typedef {Object} SchoolData
 * @property {string}  id         - School or super-admin UUID
 * @property {string}  name       - Display name
 * @property {string|null} logo   - Logo URL (Supabase storage path)
 * @property {string}  shortCode  - Uppercase short code
 * @property {'school'|'super_admin'} type
 * @property {boolean} isActive
 * @property {Array}   [schools]  - Only present when type === 'super_admin'
 * @property {string}  [schoolName]
 */

/**
 * Fetch school / tenant data for a given subdomain.
 *
 * @param {string} subdomain - The raw subdomain string (e.g. 'xamdaan')
 * @returns {Promise<SchoolData|null>} Resolved school data, or null if not found.
 */
export async function getSchoolBySubdomain(subdomain) {
  if (!subdomain || typeof subdomain !== 'string') return null;

  // Normalise: uppercase to match shortCode convention in the DB
  const code = subdomain.trim().toUpperCase();

  try {
    const res = await fetch(`${BASE_URL}/api/schools/by-code/${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // 8-second timeout via AbortController
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) return null;

    if (!res.ok) {
      console.warn(`[tenantHelper] Unexpected status ${res.status} for subdomain "${subdomain}"`);
      return null;
    }

    const data = await res.json();
    return data ?? null;
  } catch (err) {
    // Network error / timeout — do not throw; caller handles null gracefully
    console.error('[tenantHelper] Failed to resolve subdomain:', subdomain, err?.message ?? err);
    return null;
  }
}

/**
 * Convenience: returns true if the current browser hostname carries a subdomain
 * that should trigger tenant routing.
 *
 * Safe to call only in browser context (window is defined).
 *
 * @returns {{ isSubdomain: boolean, subdomain: string|null }}
 */
export function detectSubdomainClient() {
  if (typeof window === 'undefined') return { isSubdomain: false, subdomain: null };

  const hostname = window.location.hostname;

  // Match subdomain.localhost (local dev)
  const localMatch = hostname.match(/^([a-z0-9-]+)\.localhost$/i);
  if (localMatch) return { isSubdomain: true, subdomain: localMatch[1].toLowerCase() };

  // Match subdomain.dugsipro.so (production)
  const prodMatch = hostname.match(/^([a-z0-9-]+)\.dugsipro\.so$/i);
  if (prodMatch) return { isSubdomain: true, subdomain: prodMatch[1].toLowerCase() };

  return { isSubdomain: false, subdomain: null };
}
