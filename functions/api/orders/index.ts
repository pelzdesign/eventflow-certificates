import { demoConfigurationReady, jsonResponse, sameOrigin, type CertificatesEnv } from "../_shared.js";

interface PagesContext { request: Request; env: CertificatesEnv; }
interface VariantRow {
  service_id: string;
  service_title: string;
  service_description: string | null;
  variant_id: string;
  variant_title: string;
  variant_description: string | null;
  amount_minor: number;
  currency: string;
  activation_url: string | null;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4000) return jsonResponse({ error: "REQUEST_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  if (!isRecord(body) || typeof body.variantId !== "string" || !body.variantId.trim()) {
    return jsonResponse({ error: "CATALOG_VARIANT_REQUIRED" }, 400);
  }

  try {
    const variant = await env.CERTIFICATES_DB.prepare(`
      SELECT s.id AS service_id, s.title AS service_title, s.description AS service_description,
             v.id AS variant_id, v.title AS variant_title, v.description AS variant_description,
             v.amount_minor, v.currency, s.activation_url
      FROM catalog_variants v
      INNER JOIN catalog_services s ON s.id = v.service_id
      WHERE v.id = ? AND s.organization_id = ?
        AND s.is_active = 1 AND v.is_active = 1
      LIMIT 1
    `).bind(body.variantId.trim(), env.DEMO_ORGANIZATION_ID).first<VariantRow>();

    if (!variant) return jsonResponse({ error: "CATALOG_VARIANT_NOT_AVAILABLE" }, 404);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const token = randomPublicToken();
    await env.CERTIFICATES_DB.prepare(`
      INSERT INTO gift_orders (
        id, organization_id, public_token, catalog_service_id, catalog_variant_id,
        service_title_snapshot, variant_title_snapshot, description_snapshot,
        amount_minor, currency, activation_url, payment_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', ?, ?)
    `).bind(
      id, env.DEMO_ORGANIZATION_ID, token, variant.service_id, variant.variant_id,
      variant.service_title, variant.variant_title,
      variant.variant_description ?? variant.service_description,
      variant.amount_minor, variant.currency, variant.activation_url, now, now,
    ).run();

    return jsonResponse({
      order: {
        publicToken: token,
        serviceTitle: variant.service_title,
        variantTitle: variant.variant_title,
        description: variant.variant_description ?? variant.service_description,
        amountMinor: variant.amount_minor,
        currency: variant.currency,
        paymentStatus: "awaiting_payment",
        publicUrl: `/order/${token}`,
      },
    }, 201);
  } catch {
    return jsonResponse({ error: "ORDER_CREATE_FAILED" }, 500);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function randomPublicToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
