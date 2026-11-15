import { VASTU_DEMO_CATALOG_ITEM } from "../vastu-brand.js";
import { demoConfigurationReady, jsonResponse, sameOrigin, type CertificatesEnv } from "./_shared.js";

interface PagesContext { request: Request; env: CertificatesEnv; }

interface BootstrapStatement {
  bind(...values: unknown[]): BootstrapStatement;
}
interface BootstrapDatabase {
  prepare(sql: string): BootstrapStatement;
  batch(statements: BootstrapStatement[]): Promise<unknown>;
}

/**
 * Creates the fixed first-pilot catalogue entry for the isolated DEMO organization.
 * INSERT OR IGNORE makes this safe to call repeatedly and preserves later manual edits.
 */
export async function bootstrapVastuCatalog(
  database: BootstrapDatabase,
  organizationId: string,
  now = new Date().toISOString(),
): Promise<void> {
  const item = VASTU_DEMO_CATALOG_ITEM;
  await database.batch([
    database.prepare(`
      INSERT OR IGNORE INTO catalog_services (
        id, organization_id, slug, title, description, category,
        is_active, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Васту', 1, 10, ?, ?)
    `).bind(
      item.serviceId, organizationId, item.serviceSlug, item.serviceTitle,
      item.serviceDescription, now, now,
    ),
    database.prepare(`
      INSERT OR IGNORE INTO catalog_variants (
        id, service_id, title, description, amount_minor, currency,
        is_active, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 10, ?, ?)
    `).bind(
      item.variantId, item.serviceId, item.variantTitle, item.variantDescription,
      item.amountMinor, item.currency, now, now,
    ),
  ]);
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);
  if (!sameOrigin(request)) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);

  try {
    await bootstrapVastuCatalog(
      env.CERTIFICATES_DB as unknown as BootstrapDatabase,
      env.DEMO_ORGANIZATION_ID!,
    );
    return jsonResponse({ initialized: true });
  } catch {
    return jsonResponse({ error: "CATALOG_BOOTSTRAP_FAILED" }, 500);
  }
}
