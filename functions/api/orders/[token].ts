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
  certificate_public_token: string | null;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { env, params } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  const token = params.token ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return jsonResponse({ error: "ORDER_NOT_FOUND" }, 404);

  try {
    const row = await env.CERTIFICATES_DB.prepare(`
      SELECT service_title_snapshot, variant_title_snapshot, description_snapshot,
             amount_minor, currency, payment_status, payment_reported_at,
             certificate_date, recipient_name, greeting_text, sender_signature, certificate_id,
             c.public_token AS certificate_public_token
      FROM gift_orders o LEFT JOIN certificates c ON c.id = o.certificate_id
      WHERE o.public_token = ? LIMIT 1
    `).bind(token).first<OrderRow>();
    if (!row) return jsonResponse({ error: "ORDER_NOT_FOUND" }, 404);
    return jsonResponse({
      order: {
        serviceTitle: row.service_title_snapshot,
        variantTitle: row.variant_title_snapshot,
        description: row.description_snapshot,
        amountMinor: row.amount_minor,
        currency: row.currency,
        paymentStatus: row.payment_status,
        paymentReportedAt: row.payment_reported_at,
        certificateDate: row.certificate_date,
        recipientName: row.recipient_name,
        greetingText: row.greeting_text,
        senderSignature: row.sender_signature,
        issued: Boolean(row.certificate_id),
        publicUrl: row.certificate_public_token ? `/certificates/${row.certificate_public_token}` : null,
        canPersonalize: row.payment_status !== "awaiting_payment" && !row.certificate_id,
        canIssue: row.payment_status === "confirmed" && !row.certificate_id,
      },
    });
  } catch {
    return jsonResponse({ error: "ORDER_READ_FAILED" }, 500);
  }
}

export async function onRequestPut(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const token = params.token ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return jsonResponse({ error: "ORDER_NOT_FOUND" }, 404);

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 8000) return jsonResponse({ error: "REQUEST_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  if (!isRecord(body)) return jsonResponse({ error: "INVALID_ORDER_DETAILS" }, 400);

  const personalization = normalizeOrderPersonalization(body);
  if (!personalization) return jsonResponse({ error: "INVALID_PERSONALIZATION" }, 400);

  try {
    const now = new Date().toISOString();
    const result = await env.CERTIFICATES_DB.prepare(`
      UPDATE gift_orders
      SET certificate_date = ?, recipient_name = ?, greeting_text = ?,
          sender_signature = ?, updated_at = ?
      WHERE public_token = ? AND payment_status IN ('payment_reported', 'confirmed')
        AND certificate_id IS NULL
    `).bind(
      personalization.certificateDate, personalization.recipientName,
      personalization.greetingText, personalization.senderSignature, now, token,
    ).run();
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


export interface NormalizedOrderPersonalization {
  certificateDate: string | null;
  recipientName: string | null;
  greetingText: string | null;
  senderSignature: string | null;
}

/** All gift-personalization fields are optional; empty input is stored as NULL. */
export function normalizeOrderPersonalization(
  body: Record<string, unknown>,
): NormalizedOrderPersonalization | null {
  const certificateDate = typeof body.certificateDate === "string" ? body.certificateDate.trim() : "";
  const recipientName = typeof body.recipientName === "string" ? body.recipientName.trim() : "";
  const greetingText = typeof body.greetingText === "string" ? body.greetingText.trim() : "";
  const senderSignature = typeof body.senderSignature === "string" ? body.senderSignature.trim() : "";

  if (certificateDate) {
    const parsedDate = new Date(`${certificateDate}T00:00:00.000Z`);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(certificateDate) &&
      !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === certificateDate;
    if (!validDate) return null;
  }
  if (recipientName.length > 180 || greetingText.length > 2000 || senderSignature.length > 180) return null;

  return {
    certificateDate: certificateDate || null,
    recipientName: recipientName || null,
    greetingText: greetingText || null,
    senderSignature: senderSignature || null,
  };
}
