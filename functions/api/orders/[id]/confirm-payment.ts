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
      actor: { userId: session.userId },
      organizationId: session.organizationId,
      permission: "certificate:issue",
    });
    const now = new Date().toISOString();
    const result = await env.CERTIFICATES_DB.prepare(`
      UPDATE gift_orders
      SET payment_status = 'confirmed', payment_confirmed_at = ?, updated_at = ?
      WHERE id = ? AND organization_id = ?
        AND payment_status = 'payment_reported' AND certificate_id IS NULL
    `).bind(now, now, params.id ?? "", session.organizationId).run();
    if ((result.meta?.changes ?? 0) === 1) return jsonResponse({ paymentStatus: "confirmed" });

    const order = await env.CERTIFICATES_DB.prepare(
      "SELECT payment_status, certificate_id FROM gift_orders WHERE id = ? AND organization_id = ? LIMIT 1",
    ).bind(params.id ?? "", session.organizationId).first<{ payment_status: string; certificate_id: string | null }>();
    if (!order) return jsonResponse({ error: "ORDER_NOT_FOUND" }, 404);
    if (order.certificate_id) return jsonResponse({ error: "CERTIFICATE_ALREADY_ISSUED" }, 409);
    if (order.payment_status === "confirmed") return jsonResponse({ paymentStatus: "confirmed" });
    return jsonResponse({ error: "PAYMENT_NOT_REPORTED_BY_BUYER" }, 409);
  } catch (error) {
    if (error instanceof Error && error.message === "ORGANIZATION_ACCESS_DENIED") {
      return jsonResponse({ error: "ORGANIZATION_ACCESS_DENIED" }, 403);
    }
    return jsonResponse({ error: "PAYMENT_CONFIRMATION_FAILED" }, 500);
  }
}
