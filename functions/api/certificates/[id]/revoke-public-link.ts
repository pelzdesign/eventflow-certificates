import { DemoPlatformAccess, demoConfigurationReady, getDemoSession, jsonResponse, sameOrigin, type CertificatesEnv } from "../../_shared.js";

interface PagesContext { request: Request; params: { id?: string }; env: CertificatesEnv; }

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const session = await getDemoSession(request, env);
  if (!session || session.userId !== env.DEMO_USER_ID || session.organizationId !== env.DEMO_ORGANIZATION_ID) {
    return jsonResponse({ error: "AUTHENTICATION_REQUIRED" }, 401);
  }
  try {
    await new DemoPlatformAccess(request, env).assertOrganizationPermission({
      actor: { userId: session.userId }, organizationId: session.organizationId, permission: "certificate:issue",
    });
    const now = new Date().toISOString();
    const result = await env.CERTIFICATES_DB.prepare(`
      UPDATE certificates SET public_access_revoked_at = COALESCE(public_access_revoked_at, ?), version = version + 1
      WHERE id = ? AND organization_id = ?
    `).bind(now, params.id ?? "", session.organizationId).run();
    if ((result.meta?.changes ?? 0) === 1) return jsonResponse({ revoked: true });
    return jsonResponse({ error: "CERTIFICATE_NOT_FOUND" }, 404);
  } catch (error) {
    if (error instanceof Error && error.message === "ORGANIZATION_ACCESS_DENIED") return jsonResponse({ error: "ORGANIZATION_ACCESS_DENIED" }, 403);
    return jsonResponse({ error: "PUBLIC_LINK_REVOCATION_FAILED" }, 500);
  }
}
