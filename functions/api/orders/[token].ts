import { demoConfigurationReady, jsonResponse, sameOrigin, type CertificatesEnv } from "../_shared.js";

interface PagesContext { request: Request; params: { token?: string }; env: CertificatesEnv; }
interface OrderRow {
  service_title_snapshot: string;
  variant_title_snapshot: string;
  description_snapshot: string | null;
  amount_minor: number;
  currency: string;
  payment_status: "awaiting_payment" | "payment_reported" | "confirmed";
  payment_reported_at: string | null;
  certificate_date: string | null;
  recipient_name: string | null;
  greeting_text: string | null;
  sender_signature: string | null;
  certificate_id: string | null;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { env, params } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  const token = params.token ?? "";
  const parsedDate = new Date(`${certificateDate}T00:00:00.000Z`);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(certificateDate) &&
    !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === certificateDate;
  if (!validDate ||
      !recipientName || recipientName.length > 180 ||
      !greetingText || greetingText.length > 2000 ||
      !senderSignature || senderSignature.length > 180) {
    return jsonResponse({ error: "INVALID_PERSONALIZATION" }, 400);
  }

  try {
    const now = new Date().toISOString();
    const result = await env.CERTIFICATES_DB.prepare(`
      UPDATE gift_orders
      SET certificate_date = ?, recipient_name = ?, greeting_text = ?,
          sender_signature = ?, updated_at = ?
      WHERE public_token = ? AND payment_status IN ('payment_reported', 'confirmed')
        AND certificate_id IS NULL
    `).bind(certificateDate, recipientName, greetingText, senderSignature, now, token).run();
    if ((result.meta?.changes ?? 0) !== 1) {
      const existing = await env.CERTIFICATES_DB.prepare(
        "SELECT payment_status, certificate_id FROM gift_orders WHERE public_token = ? LIMIT 1",
      ).bind(token).first<{ payment_status: string; certificate_id: string | null }>();
      if (!existing) return jsonResponse({ error: "ORDER_NOT_FOUND" }, 404);
      if (existing.certificate_id) return jsonResponse({ error: "CERTIFICATE_ALREADY_ISSUED" }, 409);
      return jsonResponse({ error: "PAYMENT_NOT_REPORTED" }, 409);
    }
    return jsonResponse({ saved: true });
  } catch {
    return jsonResponse({ error: "PERSONALIZATION_SAVE_FAILED" }, 500);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
