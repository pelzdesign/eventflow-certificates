import { VASTU_BRAND_PROFILE } from "../../vastu-brand.js";
import { loadBrandProfile, normalizeEditableBrandProfile } from "../../brand-profile.js";
import { DemoPlatformAccess, demoConfigurationReady, getDemoSession, jsonResponse, sameOrigin, type CertificatesEnv } from "../_shared.js";
interface PagesContext { request: Request; env: CertificatesEnv; }

async function authorize(request: Request, env: CertificatesEnv) {
  if (!demoConfigurationReady(env)) return { error: jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503) };
  const session = await getDemoSession(request, env);
  if (!session || session.userId !== env.DEMO_USER_ID || session.organizationId !== env.DEMO_ORGANIZATION_ID) {
    return { error: jsonResponse({ error: "AUTHENTICATION_REQUIRED" }, 401) };
  }
  try {
    await new DemoPlatformAccess(request, env).assertOrganizationPermission({
      actor: { userId: session.userId }, organizationId: session.organizationId, permission: "brand:edit",
    });
  } catch {
    return { error: jsonResponse({ error: "ORGANIZATION_ACCESS_DENIED" }, 403) };
  }
  return { session };
}
function publicProfile(profile: Awaited<ReturnType<typeof loadBrandProfile>>) {
  return {
    displayName: profile.displayName, providerName: profile.providerName ?? "",
    tagline: profile.tagline, contactUrl: profile.contactUrl ?? "",
    contactLabel: profile.contactLabel ?? "Связаться со специалистом",
  };
}
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { env, request } = context;
  const access = await authorize(request, env);
  if (access.error) return access.error;
  try {
    const profile = await loadBrandProfile(env.CERTIFICATES_DB, access.session!.organizationId, VASTU_BRAND_PROFILE);
    return jsonResponse({ profile: publicProfile(profile) });
  } catch {
    return jsonResponse({ error: "BRAND_PROFILE_READ_FAILED" }, 500);
  }
}
export async function onRequestPut(context: PagesContext): Promise<Response> {
  const { env, request } = context;
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const access = await authorize(request, env);
  if (access.error) return access.error;
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4000) return jsonResponse({ error: "REQUEST_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  const editable = normalizeEditableBrandProfile(body);
  if (!editable) return jsonResponse({ error: "INVALID_BRAND_PROFILE" }, 400);
  try {
    await env.CERTIFICATES_DB.prepare(
      "INSERT INTO organization_brand_profiles (organization_id, display_name, provider_name, tagline, contact_url, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(organization_id) DO UPDATE SET provider_name = excluded.provider_name, tagline = excluded.tagline, contact_url = excluded.contact_url, updated_at = excluded.updated_at",
    ).bind(
      access.session!.organizationId, VASTU_BRAND_PROFILE.displayName, editable.providerName,
      editable.tagline, editable.contactUrl, new Date().toISOString(),
    ).run();
    const profile = await loadBrandProfile(env.CERTIFICATES_DB, access.session!.organizationId, VASTU_BRAND_PROFILE);
    return jsonResponse({ saved: true, profile: publicProfile(profile) });
  } catch {
    return jsonResponse({ error: "BRAND_PROFILE_STORAGE_UNAVAILABLE" }, 503);
  }
}
