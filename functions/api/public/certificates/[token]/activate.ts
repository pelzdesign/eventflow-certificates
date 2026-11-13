import { jsonResponse, sameOrigin, type CertificatesEnv } from "../../../_shared.js";

interface PagesContext { request: Request; params: { token?: string }; env: CertificatesEnv; }
interface ActivationRow {
  activation_url: string | null;
  status: string;
  expires_at: string | null;
  public_access_revoked_at: string | null;
}

/** A deliberate POST records activation; simply viewing the certificate stays read-only. */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const token = params.token ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return jsonResponse({ error: "CERTIFICATE_NOT_FOUND" }, 404);

  try {
    const row = await env.CERTIFICATES_DB.prepare(`
      SELECT activation_url, status, expires_at, public_access_revoked_at
      FROM certificates WHERE public_token = ? LIMIT 1
    `).bind(token).first<ActivationRow>();
    if (!row || row.public_access_revoked_at !== null) return jsonResponse({ error: "CERTIFICATE_NOT_AVAILABLE" }, 404);
    if (row.status !== "active") return jsonResponse({ error: "CERTIFICATE_NOT_ACTIVE" }, 409);
    const now = new Date().toISOString();
    if (row.expires_at && row.expires_at <= now) return jsonResponse({ error: "CERTIFICATE_EXPIRED" }, 409);
    if (!row.activation_url) return jsonResponse({ error: "ACTIVATION_CONTACT_NOT_CONFIGURED" }, 409);

    let destination: URL;
    try {
      destination = new URL(row.activation_url);
    } catch {
      return jsonResponse({ error: "ACTIVATION_CONTACT_INVALID" }, 500);
    }
    if ((destination.protocol !== "https:" && destination.protocol !== "http:") ||
        destination.username || destination.password) {
      return jsonResponse({ error: "ACTIVATION_CONTACT_INVALID" }, 500);
    }

    await env.CERTIFICATES_DB.prepare(`
      UPDATE certificates
      SET activation_requested_at = COALESCE(activation_requested_at, ?), version = version + 1
      WHERE public_token = ? AND status = 'active' AND public_access_revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
    `).bind(now, token, now).run();

    return new Response(null, {
      status: 303,
      headers: {
        Location: destination.toString(),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return jsonResponse({ error: "CERTIFICATE_ACTIVATION_FAILED" }, 500);
  }
}
