export interface BrandProfile {
  displayName: string;
  tagline: string;
  contactUrl?: string;
  contactLabel?: string;
  theme: {
    page: string;
    surface: string;
    ink: string;
    muted: string;
    line: string;
    accent: string;
    accentInk: string;
  };
}

/** Neutral fallback keeps the certificate renderer independent from a single brand. */
export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  displayName: "Подарочный сертификат",
  tagline: "Особенный подарок",
  theme: {
    page: "#f5f2ec",
    surface: "#fffefa",
    ink: "#24231f",
    muted: "#77736b",
    line: "#e9e4da",
    accent: "#526b57",
    accentInk: "#ffffff",
  },
};
