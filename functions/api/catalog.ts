import { demoConfigurationReady, jsonResponse, type CertificatesEnv } from "./_shared.js";

interface PagesContext { env: CertificatesEnv; }

interface CatalogRow {
  service_id: string;
  slug: string;
  service_title: string;
  service_description: string | null;
  category: string | null;
  variant_id: string;
  variant_title: string;
  variant_description: string | null;
  amount_minor: number;
  currency: string;
}

/** Public, read-only catalogue. Only explicitly activated items are visible. */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { env } = context;
  if (!demoConfigurationReady(env)) return jsonResponse({ error: "DEMO_NOT_CONFIGURED" }, 503);

  try {
    const result = await env.CERTIFICATES_DB.prepare(`
      SELECT s.id AS service_id, s.slug, s.title AS service_title,
             s.description AS service_description, s.category,
             v.id AS variant_id, v.title AS variant_title,
             v.description AS variant_description, v.amount_minor, v.currency
      FROM catalog_services s
      INNER JOIN catalog_variants v ON v.service_id = s.id
      WHERE s.organization_id = ?
        AND s.is_active = 1 AND v.is_active = 1
      ORDER BY s.sort_order, s.title, v.sort_order, v.title
    `).bind(env.DEMO_ORGANIZATION_ID).all<CatalogRow>();

    const services = new Map<string, {
      id: string; slug: string; title: string; description: string | null;
      category: string | null; variants: Array<{
        id: string; title: string; description: string | null;
        amountMinor: number; currency: string;
      }>;
    }>();

    for (const row of result.results ?? []) {
      let service = services.get(row.service_id);
      if (!service) {
        service = {
          id: row.service_id, slug: row.slug, title: row.service_title,
          description: row.service_description, category: row.category, variants: [],
        };
        services.set(row.service_id, service);
      }
      service.variants.push({
        id: row.variant_id, title: row.variant_title, description: row.variant_description,
        amountMinor: row.amount_minor, currency: row.currency,
      });
    }
    return jsonResponse({ services: [...services.values()] });
  } catch {
    return jsonResponse({ error: "CATALOG_READ_FAILED" }, 500);
  }
}
