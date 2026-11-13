export type CertificateId = string;
export type OrganizationId = string;
export type UserId = string;
export type PublicToken = string;

export type CertificateKind = "service" | "monetary";

export type CertificateStatus =
  | "active"
  | "redeemed"
  | "cancelled"
  | "expired";

export type CertificateValue =
  | {
      kind: "service";
      description: string;
    }
  | {
      kind: "monetary";
      amountMinor: number;
      currency: string;
    };

export interface Certificate {
  id: CertificateId;
  organizationId: OrganizationId;
  publicToken: PublicToken;
  code: string;
  kind: CertificateKind;
  value: CertificateValue;
  title: string;
  description?: string;
  recipientName?: string;
  recipientEmail?: string;
  status: CertificateStatus;
  issuedAt: string;
  expiresAt?: string;
  createdBy: UserId;
  version: number;
}

export type NewCertificate = Omit<Certificate, "id" | "publicToken" | "status" | "version">;

export interface PublicCertificate {
  code: string;
  kind: CertificateKind;
  value: CertificateValue;
  title: string;
  description?: string;
  recipientName?: string;
  status: CertificateStatus;
  issuedAt: string;
  expiresAt?: string;
}
