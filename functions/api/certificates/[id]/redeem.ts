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
    const result = await env.CERTIFICATES_DB.prepare(`
      UPDATE certificates SET status = 'redeemed', version = version + 1
      WHERE id = ? AND organization_id = ? AND status = 'active'
        AND public_access_revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
    `).bind(params.id ?? "", session.organizationId, new Date().toISOString()).run();
    if ((result.meta?.changes ?? 0) === 1) return jsonResponse({ status: "redeemed" });
    const row = await env.CERTIFICATES_DB.prepare(
      "SELECT status FROM certificates WHERE id = ? AND organization_id = ? LIMIT 1",
    ).bind(params.id ?? "", session.organizationId).first<{ status: string }>();
    if (!row) return jsonResponse({ error: "CERTIFICATE_NOT_FOUND" }, 404);
    if (row.status === "redeemed") return jsonResponse({ status: "redeemed" });
    return jsonResponse({ error: "CERTIFICATE_NOT_REDEEMABLE" }, 409);
  } catch (error) {
    if (error instanceof Error && error.message === "ORGANIZATION_ACCESS_DENIED") return jsonResponse({ error: "ORGANIZATION_ACCESS_DENIED" }, 403);
    return jsonResponse({ error: "CERTIFICATE_REDEMPTION_FAILED" }, 500);
  }
}
