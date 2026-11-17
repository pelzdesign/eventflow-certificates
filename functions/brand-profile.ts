import type { D1DatabasePort } from "../src/adapters/cloudflare/d1-certificate-repository.js";
import type { BrandProfile } from "../src/presentation/brand-profile.js";

export interface EditableBrandProfile {
  providerName: string | null;
  tagline: string;
  contactUrl: string;
}
interface BrandProfileRow {
  display_name: string;
  provider_name: string | null;
  tagline: string;
  contact_url: string;
}

/** Visual tokens and gift narrative stay EventFlow-managed; only content fields are overlaid from organization-scoped storage. */
export async function loadBrandProfile(database: D1DatabasePort, organizationId: string, fallback: BrandProfile): Promise<BrandProfile> {
  try {
    const row = await database.prepare(
      "SELECT display_name, provider_name, tagline, contact_url FROM organization_brand_profiles WHERE organization_id = ? LIMIT 1",
    ).bind(organizationId).first<BrandProfileRow>();
    if (!row) return fallback;
    const profile: BrandProfile = { ...fallback, displayName: row.display_name, tagline: row.tagline };
    if (row.provider_name) profile.providerName = row.provider_name;
    else delete profile.providerName;
    if (row.contact_url) profile.contactUrl = row.contact_url;
    else delete profile.contactUrl;
    return profile;
  } catch {
    // Keep the code-level Vastu profile usable until migration 0006 is applied to an isolated Preview database.
    return fallback;
  }
}

export function normalizeEditableBrandProfile(input: unknown): EditableBrandProfile | null {
  if (!isRecord(input)) return null;
  const allowed = new Set(["providerName", "tagline", "contactUrl"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;
  if (!("providerName" in input) || !("tagline" in input) || !("contactUrl" in input)) return null;
  if (input.providerName !== null && typeof input.providerName !== "string") return null;
  const providerName = typeof input.providerName === "string" ? input.providerName.trim() : "";
  const tagline = typeof input.tagline === "string" ? input.tagline.trim() : "";
  const contactUrl = typeof input.contactUrl === "string" ? input.contactUrl.trim() : "";
  if (providerName.length > 120 || tagline.length < 1 || tagline.length > 240) return null;
  if (contactUrl.length < 1 || contactUrl.length > 500 || /[\u0000-\u001f\u007f]/.test(contactUrl)) return null;
  try {
    const parsed = new URL(contactUrl);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return null;
  } catch {
    return null;
  }
  return { providerName: providerName || null, tagline, contactUrl };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
