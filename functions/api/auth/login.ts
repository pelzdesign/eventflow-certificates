import { createDemoSession, revokeDemoSession } from "../../../src/adapters/cloudflare/d1-demo-session-store.js";
import { allowLoginAttempt, constantTimeEqual, demoConfigurationReady, jsonResponse, sameOrigin, sessionStore, type CertificatesEnv } from "../_shared.js";
interface PagesContext { request: Request; env: CertificatesEnv; }
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 2048) return jsonResponse({ error: "REQUEST_TOO_LARGE" }, 413);
  if (!(await allowLoginAttempt(request, env))) return jsonResponse({ error: "TOO_MANY_ATTEMPTS" }, 429);
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return jsonResponse({ error: "REQUEST_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
  } catch { return jsonResponse({ error: "INVALID_JSON" }, 400); }
  if (!isRecord(body) || typeof body.username !== "string" || typeof body.password !== "string" || body.username.length > 256 || body.password.length > 256) {
    return jsonResponse({ error: "INVALID_CREDENTIALS" }, 400);
  }
  const valid = constantTimeEqual(body.username, env.DEMO_LOGIN_USERNAME ?? "") && constantTimeEqual(body.password, env.DEMO_LOGIN_PASSWORD ?? "");
  if (!valid) return jsonResponse({ error: "INVALID_CREDENTIALS" }, 401);
  const store = sessionStore(env);
  await revokeDemoSession(request, store);
  const session = await createDemoSession(store, { userId: env.DEMO_USER_ID as string, organizationId: env.DEMO_ORGANIZATION_ID as string });
  return jsonResponse({ authenticated: true, expiresAt: session.expiresAt }, 200, { "Set-Cookie": session.cookie });
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
