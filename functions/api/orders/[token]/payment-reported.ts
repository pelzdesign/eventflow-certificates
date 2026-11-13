import { demoConfigurationReady, jsonResponse, sameOrigin, type CertificatesEnv } from "../../_shared.js";

interface PagesContext { request: Request; params: { token?: string }; env: CertificatesEnv; }

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const token = params.token ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return jsonResponse({ error: "ORDER_NOT_FOUND" }, 404);

  try {
    const now = new Date().toISOString();
    const result = await env.CERTIFICATES_DB.prepare(`
      UPDATE gift_orders
      SET payment_status = 'payment_reported', payment_reported_at = ?, updated_at = ?
      WHERE public_token = ? AND payment_status = 'awaiting_payment' AND certificate_id IS NULL
    `).bind(now, now, token).run();

    if ((result.meta?.changes ?? 0) === 1) return jsonResponse({ paymentStatus: "payment_reported", canPersonalize: true });
    const order = await env.CERTIFICATES_DB.prepare(
      "SELECT payment_status, certificate_id FROM gift_orders WHERE public_token = ? LIMIT 1",
    ).bind(token).first<{ payment_status: string; certificate_id: string | null }>();
    if (!order) return jsonResponse({ error: "ORDER_NOT_FOUND" }, 404);
    if (order.certificate_id) return jsonResponse({ error: "CERTIFICATE_ALREADY_ISSUED" }, 409);
    if (order.payment_status === "payment_reported" || order.payment_status === "confirmed") {
      return jsonResponse({ paymentStatus: order.payment_status, canPersonalize: true });
    }
    return jsonResponse({ error: "PAYMENT_REPORT_FAILED" }, 409);
  } catch {
    return jsonResponse({ error: "PAYMENT_REPORT_FAILED" }, 500);
  }
}
