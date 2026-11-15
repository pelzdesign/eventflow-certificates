import type { PublicCertificate } from "../src/domain/certificate.js";
import { renderPublicCertificatePage } from "../src/presentation/public-certificate-page.js";
import { VASTU_BRAND_PROFILE, VASTU_DEMO_CATALOG_ITEM, VASTU_DEMO_PERSONALIZATION } from "./vastu-brand.js";
import { htmlResponse } from "./api/_shared.js";

interface PagesContext { env: Record<string, unknown>; }

/**
 * Read-only, non-issuing preview for prospective customers.
 * It creates no order, payment record or certificate and cannot be redeemed.
 */
export async function onRequestGet(_context: PagesContext): Promise<Response> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const sample: PublicCertificate = {
    code: "DEMO-VASTU-001",
    kind: "service",
    value: { kind: "service", description: VASTU_DEMO_CATALOG_ITEM.variantTitle },
    title: VASTU_DEMO_CATALOG_ITEM.serviceTitle,
    description: VASTU_DEMO_CATALOG_ITEM.variantDescription,
    recipientName: VASTU_DEMO_PERSONALIZATION.recipientName,
    giftDate: today,
    greetingText: VASTU_DEMO_PERSONALIZATION.greetingText,
    senderSignature: VASTU_DEMO_PERSONALIZATION.senderSignature,
    activationUrl: VASTU_BRAND_PROFILE.contactUrl!,
    status: "active",
    issuedAt: now.toISOString(),
  };
  return htmlResponse(renderPublicCertificatePage(sample, undefined, VASTU_BRAND_PROFILE, { previewMode: true }));
}
