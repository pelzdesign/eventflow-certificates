import { readPublicCertificate } from "../../../../src/application/read-public-certificate.js";
import { D1CertificateRepository } from "../../../../src/adapters/cloudflare/d1-certificate-repository.js";
import { jsonResponse, type CertificatesEnv } from "../../_shared.js";

interface PagesContext {
  params: { token?: string };
  env: CertificatesEnv;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const token = context.params.token ?? "";
  if (!token) return jsonResponse({ error: "CERTIFICATE_NOT_FOUND" }, 404);
  try {
    const repository = new D1CertificateRepository(context.env.CERTIFICATES_DB, { newId: () => crypto.randomUUID() }, { now: () => new Date() });
    const certificate = await readPublicCertificate(token, { repository });
    if (!certificate) return jsonResponse({ error: "CERTIFICATE_NOT_FOUND" }, 404);
    return jsonResponse({ certificate });
  } catch {
    return jsonResponse({ error: "CERTIFICATE_LOOKUP_FAILED" }, 500);
  }
}
