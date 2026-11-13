import { expiredSessionCookie, revokeDemoSession } from "../../../src/adapters/cloudflare/d1-demo-session-store.js";
import { jsonResponse, sameOrigin, sessionStore, type CertificatesEnv } from "../_shared.js";
interface PagesContext { request: Request; env: CertificatesEnv; }
export async function onRequestPost(context: PagesContext): Promise<Response> {
  if (!sameOrigin(context.request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (context.env.CERTIFICATES_DB) await revokeDemoSession(context.request, sessionStore(context.env));
  return jsonResponse({ authenticated: false }, 200, { "Set-Cookie": expiredSessionCookie() });
}
