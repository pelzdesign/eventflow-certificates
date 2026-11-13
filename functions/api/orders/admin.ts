import { DemoPlatformAccess, demoConfigurationReady, getDemoSession, jsonResponse, type CertificatesEnv } from "../_shared.js";

interface PagesContext { request: Request; env: CertificatesEnv; }
interface AdminOrderRow {
  id: string;
  public_token: string;
  service_title_snapshot: string;
  variant_title_snapshot: string;
  amount_minor: number;
  currency: string;
  payment_status: string;
  payment_reported_at: string | null;
  certificate_date: string | null;
  recipient_name: string | null;
  greeting_text: string | null;
  sender_signature: string | null;
  created_at: string;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  const session = await getDemoSession(request, env);
  if (!session || session.userId !== env.DEMO_USER_ID || session.organizationId !== env.DEMO_ORGANIZATION_ID) {
    return jsonResponse({ error: "AUTHENTICATION_REQUIRED" }, 401);
  }

  try {
    await new DemoPlatformAccess(request, env).assertOrganizationPermission({
      actor: { userId: session.userId },
      organizationId: session.organizationId,
      permission: "certificate:read",
    });
    const result = await env.CERTIFICATES_DB.prepare(`
      SELECT id, public_token, service_title_snapshot, variant_title_snapshot,
             amount_minor, currency, payment_status, payment_reported_at,
             certificate_date, recipient_name, greeting_text, sender_signature, created_at
      FROM gift_orders
      WHERE organization_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `).bind(session.organizationId).all<AdminOrderRow>();
    return jsonResponse({
      orders: (result.results ?? []).map((row) => ({
        id: row.id,
        publicToken: row.public_token,
        serviceTitle: row.service_title_snapshot,
        variantTitle: row.variant_title_snapshot,
        amountMinor: row.amount_minor,
        currency: row.currency,
        paymentStatus: row.payment_status,
        paymentReportedAt: row.payment_reported_at,
        certificateDate: row.certificate_date,
        recipientName: row.recipient_name,
        greetingText: row.greeting_text,
        senderSignature: row.sender_signature,
        createdAt: row.created_at,
      })),
      limit: 100,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORGANIZATION_ACCESS_DENIED") {
      return jsonResponse({ error: "ORGANIZATION_ACCESS_DENIED" }, 403);
    }
    return jsonResponse({ error: "ORDER_LIST_FAILED" }, 500);
  }
}
