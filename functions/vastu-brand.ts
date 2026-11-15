import type { BrandProfile } from "../src/presentation/brand-profile.js";

/**
 * First DEMO brand configuration.
 * Keep brand copy, contact details and visual tokens outside certificate business logic.
 * A future organization adapter can load the same shape from persisted brand settings.
 */
export const VASTU_BRAND_PROFILE: BrandProfile = {
  displayName: "PelzDesign | пространство по васту",
  tagline: "Подарок, который помогает по-новому почувствовать свой дом.",
  contactUrl: "https://vk.me/pelts_tatyana_vastu",
  contactLabel: "Связаться со специалистом",
  theme: {
    page: "#f3f0e8",
    surface: "#fffdf8",
    ink: "#303329",
    muted: "#77796e",
    line: "#e4dfd2",
    accent: "#68765d",
    accentInk: "#ffffff",
  },
};

export const VASTU_DEMO_CATALOG_ITEM = {
  serviceId: "vastu-express-space-review",
  serviceSlug: "express-space-review",
  serviceTitle: "Экспресс-разбор пространства по Васту",
  serviceDescription:
    "Персональный разбор пространства с картой Васту, аудиообъяснением и практическими рекомендациями.",
  variantId: "vastu-express-space-review-standard",
  variantTitle: "Персональный экспресс-разбор",
  variantDescription:
    "В подарок входят персональная карта Васту в PDF, аудиоразбор и практические рекомендации по вашему пространству.",
  amountMinor: 490000,
  currency: "RUB",
  activationUrl: "https://vk.me/pelts_tatyana_vastu",
} as const;
