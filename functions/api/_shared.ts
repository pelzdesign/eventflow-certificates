import type { D1DatabasePort } from "../../src/adapters/cloudflare/d1-certificate-repository.js";
import type { AuthenticatedActor, CertificatePermission, PlatformAccessPort } from "../../src/ports/platform-access.js";

export interface CertificatesEnv {
  CERTIFICATES_DB: D1DatabasePort;
  DEMO_API_TOKEN?: string;
  DEMO_USER_ID?: string;
  DEMO_ORGANIZATION_ID?: string;
}

export class DemoPlatformAccess implements PlatformAccessPort {
  constructor(private readonly request: Request, private readonly env: CertificatesEnv) {}

  async getAuthenticatedActor(): Promise<AuthenticatedActor | null> {
    const expected = this.env.DEMO_API_TOKEN;
    if (!expected) return null;
    const authorization = this.request.headers.get("Authorization") ?? "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!constantTimeEqual(supplied, expected)) return null;
    const userId = this.env.DEMO_USER_ID;
    return userId ? { userId } : null;
  }

  async assertOrganizationPermission(input: { actor: AuthenticatedActor; organizationId: string; permission: CertificatePermission }): Promise<void> {
    if (!this.env.DEMO_ORGANIZATION_ID || input.organizationId !== this.env.DEMO_ORGANIZATION_ID || input.actor.userId !== this.env.DEMO_USER_ID || input.permission !== "certificate:issue") {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }
  }
}

export function demoConfigurationReady(env: CertificatesEnv): boolean {
  return Boolean(env.CERTIFICATES_DB && env.DEMO_API_TOKEN && env.DEMO_USER_ID && env.DEMO_ORGANIZATION_ID);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}
