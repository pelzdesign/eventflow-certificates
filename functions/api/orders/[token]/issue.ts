import { demoConfigurationReady, jsonResponse, sameOrigin, type CertificatesEnv } from "../../../_shared.js";

interface PagesContext { request: Request; params: { token?: string }; env: CertificatesEnv; }
interface IssuableOrder {
  id: string;
  organization_id: string;
  service_title_snapshot: string;
  variant_title_snapshot: string;
  description_snapshot: string | null;
  amount_minor: number;
  currency: string;
  certificate_date: string;
  recipient_name: string;
  greeting_text: string;
  sender_signature: string;
  certificate_id: string | null;
  issuance_status: string;
}
interface ExistingCertificate { public_token: string; }

/**
 * Issuance is a single D1 batch: the certificate insert is conditional on the
 * order still being confirmed/unissued, and the order is linked in the same
 * transaction. Repeated requests return the already-issued public URL.
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const token = params.token ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return jsonResponse({ error: "ORDER_NOT_FOUND" }, 404);

  try {
    const order = await env.CERTIFICATES_DB.prepare(`
      SELECT id, organization_id, service_title_snapshot, variant_title_snapshot,
             description_snapshot, amount_minor, currency, certificate_date,
             recipient_name, greeting_text, sender_signature, certificate_id, issuance_status
      FROM gift_orders WHERE public_token = ? LIMIT 1
    `).bind(token).first<IssuableOrder>();

    if (!order) return jsonResponse({ error: "ORDER_NOT_FOUND" }, 404);

    if (order.certificate_id) {
      const existing = await env.CERTIFICATES_DB.prepare(
        "SELECT public_token FROM certificates WHERE id = ? LIMIT 1",
      ).bind(order.certificate_id).first<ExistingCertificate>();
      if (!existing) return jsonResponse({ error: "ISSUED_CERTIFICATE_NOT_FOUND" }, 500);
      return jsonResponse({ issued: true, publicUrl: `/certificates/${existing.public_token}` });
    }

    if (order.organization_id !== env.DEMO_ORGANIZATION_ID ||
        order.issuance_status !== "not_started" ||
        !order.certificate_date || !order.recipient_name ||
        !order.greeting_text || !order.sender_signature) {
      return jsonResponse({ error: "ORDER_NOT_READY" }, 409);
    }
    if (order.payment_status !== undefined) {
      // Payment is checked again in the atomic SQL below; this branch is intentionally not trusted.
    }

    const certificateId = crypto.randomUUID();
    const publicToken = randomPublicToken();
    const code = `GIFT-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const now = new Date().toISOString();
    const valueJson = JSON.stringify({ kind: "service", description: order.variant_title_snapshot });

    const batchDb = env.CERTIFICATES_DB as unknown as {
      prepare(sql: string): { bind(...values: unknown[]): unknown };
      batch(statements: unknown[]): Promise<Array<{ meta?: { changes?: number } }>>;
    };

    const results = await batchDb.batch([
      batchDb.prepare(`
        INSERT INTO certificates (
          id, organization_id, public_token, code, kind, value_json, title,
          description, recipient_name, recipient_email, gift_date, greeting_text,
          sender_signature, status, issued_at, expires_at, created_by, version
        )
        SELECT ?, ?, ?, ?, 'service', ?, ?, ?, ?, NULL, ?, ?, ?, 'active', ?, NULL, ?, 1
        WHERE EXISTS (
          SELECT 1 FROM gift_orders
          WHERE id = ? AND organization_id = ? AND payment_status = 'confirmed'
            AND certificate_id IS NULL AND issuance_status = 'not_started'
            AND certificate_date IS NOT NULL AND recipient_name IS NOT NULL
            AND greeting_text IS NOT NULL AND sender_signature IS NOT NULL
        )
      `).bind(
        certificateId, order.organization_id, publicToken, code, valueJson,
        order.service_title_snapshot, order.description_snapshot,
        order.recipient_name, order.certificate_date, order.greeting_text,
        order.sender_signature, now, env.DEMO_USER_ID,
        order.id, order.organization_id,
      ),
      batchDb.prepare(`
        UPDATE gift_orders
        SET certificate_id = ?, issuance_status = 'issued', updated_at = ?
        WHERE id = ? AND organization_id = ? AND payment_status = 'confirmed'
          AND certificate_id IS NULL AND issuance_status = 'not_started'
      `).bind(certificateId, now, order.id, order.organization_id),
    ]);

    if ((results[1]?.meta?.changes ?? 0) === 1) {
      return jsonResponse({ issued: true, publicUrl: `/certificates/${publicToken}` }, 201);
    }

    const latest = await env.CERTIFICATES_DB.prepare(
      "SELECT certificate_id FROM gift_orders WHERE id = ? AND organization_id = ? LIMIT 1",
    ).bind(order.id, order.organization_id).first<{ certificate_id: string | null }>();
    if (latest?.certificate_id) {
      const existing = await env.CERTIFICATES_DB.prepare(
        "SELECT public_token FROM certificates WHERE id = ? LIMIT 1",
      ).bind(latest.certificate_id).first<ExistingCertificate>();
      if (existing) return jsonResponse({ issued: true, publicUrl: `/certificates/${existing.public_token}` });
    }
    return jsonResponse({ error: "PAYMENT_NOT_CONFIRMED_OR_ORDER_NOT_READY" }, 409);
  } catch {
    return jsonResponse({ error: "CERTIFICATE_ISSUE_FAILED" }, 500);
  }
}

function randomPublicToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
