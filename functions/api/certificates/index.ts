import { issueCertificate } from "../../../src/application/issue-certificate.js";
import { D1CertificateRepository } from "../../../src/adapters/cloudflare/d1-certificate-repository.js";
import type { NewCertificate } from "../../../src/domain/certificate.js";
import { DemoPlatformAccess, demoConfigurationReady, jsonResponse, type CertificatesEnv } from "../_shared.js";

interface PagesContext {
  request: Request;
  env: CertificatesEnv;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  let certificate: NewCertificate;
  try {
    certificate = parseDraft(body, env.DEMO_ORGANIZATION_ID as string);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "INVALID_CERTIFICATE" }, 400);
  }

  try {
    const repository = new D1CertificateRepository(env.CERTIFICATES_DB, { newId: () => crypto.randomUUID() }, { now: () => new Date() });
    const issued = await issueCertificate({ certificate }, {
      access: new DemoPlatformAccess(request, env),
      repository,
      tokens: { newToken: () => crypto.randomUUID().replaceAll("-", "") },
    });
    return jsonResponse({ certificate: { id: issued.id, code: issued.code, status: issued.status, issuedAt: issued.issuedAt, publicUrl: `/certificates/${issued.publicToken}` } }, 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "AUTHENTICATION_REQUIRED") return jsonResponse({ error: code }, 401);
    if (code === "ORGANIZATION_ACCESS_DENIED") return jsonResponse({ error: code }, 403);
    return jsonResponse({ error: "CERTIFICATE_ISSUE_FAILED" }, 500);
  }
}

function parseDraft(value: unknown, organizationId: string): NewCertificate {
  if (!isRecord(value)) throw new Error("INVALID_CERTIFICATE_BODY");
  const code = requiredString(value.code, "CERTIFICATE_CODE_REQUIRED");
  const title = requiredString(value.title, "CERTIFICATE_TITLE_REQUIRED");
  const kind = value.kind;
  if (kind !== "service" && kind !== "monetary") throw new Error("INVALID_CERTIFICATE_KIND");
  if (!isRecord(value.value) || value.value.kind !== kind) throw new Error("INVALID_CERTIFICATE_VALUE");

  let certificateValue: NewCertificate["value"];
  if (kind === "service") {
    certificateValue = { kind, description: requiredString(value.value.description, "SERVICE_DESCRIPTION_REQUIRED") };
  } else {
    const amountMinor = value.value.amountMinor;
    const currency = requiredString(value.value.currency, "INVALID_CURRENCY_CODE");
    if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("INVALID_MONETARY_AMOUNT");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("INVALID_CURRENCY_CODE");
    certificateValue = { kind, amountMinor, currency };
  }

  const draft: NewCertificate = { organizationId, code, title, kind, value: certificateValue };
  assignOptionalString(draft, "description", value.description);
  assignOptionalString(draft, "recipientName", value.recipientName);
  assignOptionalString(draft, "recipientEmail", value.recipientEmail);
  assignOptionalString(draft, "expiresAt", value.expiresAt);
  return draft;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requiredString(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(errorCode);
  return value.trim();
}
function assignOptionalString<K extends "description" | "recipientName" | "recipientEmail" | "expiresAt">(target: NewCertificate, key: K, value: unknown): void {
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "string") throw new Error(`INVALID_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);
  target[key] = value.trim();
}
