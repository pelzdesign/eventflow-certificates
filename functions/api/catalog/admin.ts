import { VASTU_DEMO_CATALOG_ITEM } from "../../vastu-brand.js";
import { DemoPlatformAccess, demoConfigurationReady, getDemoSession, jsonResponse, sameOrigin, type CertificatesEnv } from "../_shared.js";

interface PagesContext { request: Request; env: CertificatesEnv; }
interface ServiceRow { id: string; slug: string; title: string; description: string | null; category: string | null; }
interface VariantRow { id: string; title: string; description: string | null; amount_minor: number; currency: string; is_active: number; sort_order: number; }

async function authorize(request: Request, env: CertificatesEnv) {
  if (!demoConfigurationReady(env)) return { error: jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503) };
  const session = await getDemoSession(request, env);
  if (!session || session.userId !== env.DEMO_USER_ID || session.organizationId !== env.DEMO_ORGANIZATION_ID) {
    return { error: jsonResponse({ error: "AUTHENTICATION_REQUIRED" }, 401) };
  }
  try {
    await new DemoPlatformAccess(request, env).assertOrganizationPermission({
      actor: { userId: session.userId }, organizationId: session.organizationId, permission: "catalog:edit",
    });
  } catch {
    return { error: jsonResponse({ error: "ORGANIZATION_ACCESS_DENIED" }, 403) };
  }
  return { session };
}

async function readCatalog(env: CertificatesEnv, organizationId: string) {
  const services = await env.CERTIFICATES_DB.prepare(
    "SELECT id, slug, title, description, category FROM catalog_services WHERE organization_id = ? ORDER BY sort_order, title",
  ).bind(organizationId).all<ServiceRow>();
  const output = [];
  for (const service of services.results ?? []) {
    const variants = await env.CERTIFICATES_DB.prepare(
      "SELECT id, title, description, amount_minor, currency, is_active, sort_order FROM catalog_variants WHERE service_id = ? ORDER BY sort_order, title",
    ).bind(service.id).all<VariantRow>();
    output.push({
      id: service.id, slug: service.slug, title: service.title, description: service.description,
      category: service.category,
      variants: (variants.results ?? []).map((v) => ({
        id: v.id, title: v.title, description: v.description, amountMinor: v.amount_minor,
        currency: v.currency, isActive: v.is_active === 1,
      })),
    });
  }
  return output;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { env, request } = context;
  const access = await authorize(request, env);
  if (access.error) return access.error;
  try {
    return jsonResponse({ services: await readCatalog(env, access.session!.organizationId) });
  } catch {
    return jsonResponse({ error: "CATALOG_READ_FAILED" }, 500);
  }
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { env, request } = context;
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const access = await authorize(request, env);
  if (access.error) return access.error;

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 8000) return jsonResponse({ error: "REQUEST_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  if (!isRecord(body) ||
      typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 160 ||
      (body.description !== undefined && body.description !== null && typeof body.description !== "string") ||
      (typeof body.description === "string" && body.description.length > 2000) ||
      (body.category !== undefined && body.category !== null && (typeof body.category !== "string" || body.category.length > 80)) ||
      !isRecord(body.initialVariant) ||
      typeof body.initialVariant.title !== "string" || !body.initialVariant.title.trim() || body.initialVariant.title.trim().length > 120 ||
      (body.initialVariant.description !== undefined && body.initialVariant.description !== null && typeof body.initialVariant.description !== "string") ||
      (typeof body.initialVariant.description === "string" && body.initialVariant.description.length > 2000) ||
      !Number.isSafeInteger(body.initialVariant.amountMinor) || Number(body.initialVariant.amountMinor) <= 0 ||
      Number(body.initialVariant.amountMinor) > 999999999 ||
      typeof body.initialVariant.currency !== "string" || !/^[A-Z]{3}$/.test(body.initialVariant.currency)) {
    return jsonResponse({ error: "INVALID_SERVICE_DATA" }, 400);
  }

  const organizationId = access.session!.organizationId;
  const serviceId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = "service-" + serviceId.slice(0, 8);
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const category = typeof body.category === "string" ? body.category.trim() || null : null;
  const variantDescription = typeof body.initialVariant.description === "string"
    ? body.initialVariant.description.trim() || null : null;

  try {
    // Keep the service unpublished until its first valid variant has been inserted.
    await env.CERTIFICATES_DB.prepare(
      "INSERT INTO catalog_services (id, organization_id, slug, title, description, category, activation_url, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)",
    ).bind(serviceId, organizationId, slug, body.title.trim(), description, category, VASTU_DEMO_CATALOG_ITEM.activationUrl, now, now).run();
    await env.CERTIFICATES_DB.prepare(
      "INSERT INTO catalog_variants (id, service_id, title, description, amount_minor, currency, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)",
    ).bind(variantId, serviceId, body.initialVariant.title.trim(), variantDescription,
      Number(body.initialVariant.amountMinor), body.initialVariant.currency, now, now).run();
    await env.CERTIFICATES_DB.prepare(
      "UPDATE catalog_services SET is_active = 1, updated_at = ? WHERE id = ? AND organization_id = ?",
    ).bind(now, serviceId, organizationId).run();
    return jsonResponse({ services: await readCatalog(env, organizationId), createdServiceId: serviceId }, 201);
  } catch {
    return jsonResponse({ error: "CATALOG_CREATE_FAILED" }, 500);
  }
}

export async function onRequestPut(context: PagesContext): Promise<Response> {
  const { env, request } = context;
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const access = await authorize(request, env);
  if (access.error) return access.error;

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return jsonResponse({ error: "REQUEST_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  if (!isRecord(body) || typeof body.serviceId !== "string" ||
      typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 160 ||
      (body.description !== null && body.description !== undefined && typeof body.description !== "string") ||
      (typeof body.description === "string" && body.description.length > 2000) ||
      !Array.isArray(body.variants) || body.variants.length < 1 || body.variants.length > 20) {
    return jsonResponse({ error: "INVALID_CATALOG_DATA" }, 400);
  }

  const organizationId = access.session!.organizationId;
  const service = await env.CERTIFICATES_DB.prepare(
    "SELECT id FROM catalog_services WHERE id = ? AND organization_id = ? LIMIT 1",
  ).bind(body.serviceId, organizationId).first<{ id: string }>();
  if (!service) return jsonResponse({ error: "SERVICE_NOT_FOUND" }, 404);

  const existing = await env.CERTIFICATES_DB.prepare(
    "SELECT id FROM catalog_variants WHERE service_id = ?",
  ).bind(service.id).all<{ id: string }>();
  const existingIds = new Set((existing.results ?? []).map((v) => v.id));
  const seenIds = new Set<string>();
  const variants: Array<{ id: string; title: string; description: string | null; amountMinor: number; currency: string; isActive: boolean; isNew: boolean }> = [];

  for (const raw of body.variants) {
    if (!isRecord(raw) || typeof raw.title !== "string" || !raw.title.trim() || raw.title.trim().length > 120 ||
        (raw.description !== null && raw.description !== undefined && typeof raw.description !== "string") ||
        (typeof raw.description === "string" && raw.description.length > 2000) ||
        !Number.isSafeInteger(raw.amountMinor) || Number(raw.amountMinor) <= 0 || Number(raw.amountMinor) > 999999999 ||
        typeof raw.currency !== "string" || !/^[A-Z]{3}$/.test(raw.currency) ||
        typeof raw.isActive !== "boolean") {
      return jsonResponse({ error: "INVALID_VARIANT_DATA" }, 400);
    }
    const id = typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID();
    const isNew = !existingIds.has(id);
    if (!isNew && seenIds.has(id)) return jsonResponse({ error: "DUPLICATE_VARIANT" }, 400);
    if (raw.id && isNew) return jsonResponse({ error: "VARIANT_NOT_FOUND" }, 404);
    seenIds.add(id);
    variants.push({
      id, title: raw.title.trim(), description: typeof raw.description === "string" ? raw.description.trim() || null : null,
      amountMinor: Number(raw.amountMinor), currency: raw.currency, isActive: raw.isActive, isNew,
    });
  }
  if (!variants.some((v) => v.isActive)) return jsonResponse({ error: "AT_LEAST_ONE_ACTIVE_VARIANT_REQUIRED" }, 400);

  const now = new Date().toISOString();
  const statements = [
    env.CERTIFICATES_DB.prepare(
      "UPDATE catalog_services SET title = ?, description = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
    ).bind(body.title.trim(), typeof body.description === "string" ? body.description.trim() || null : null, now, service.id, organizationId),
    ...variants.map((v) => v.isNew
      ? env.CERTIFICATES_DB.prepare(
          "INSERT INTO catalog_variants (id, service_id, title, description, amount_minor, currency, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
        ).bind(v.id, service.id, v.title, v.description, v.amountMinor, v.currency, v.isActive ? 1 : 0, now, now)
      : env.CERTIFICATES_DB.prepare(
          "UPDATE catalog_variants SET title = ?, description = ?, amount_minor = ?, currency = ?, is_active = ?, updated_at = ? WHERE id = ? AND service_id = ?",
        ).bind(v.title, v.description, v.amountMinor, v.currency, v.isActive ? 1 : 0, now, v.id, service.id)),
  ];
  try {
    for (const statement of statements) await statement.run();
    return jsonResponse({ services: await readCatalog(env, organizationId) });
  } catch {
    return jsonResponse({ error: "CATALOG_SAVE_FAILED" }, 500);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
