export type CertificateId = string;
export type OrganizationId = string;
export type UserId = string;
export type PublicToken = string;
export type CertificateKind = "service" | "monetary";
export type CertificateStatus = "active" | "redeemed" | "cancelled" | "expired";
export type CertificateValue =
  | { kind: "service"; description: string }
  | { kind: "monetary"; amountMinor: number; currency: string };
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
  giftDate?: string;
  greetingText?: string;
  senderSignature?: string;
  status: CertificateStatus;
  issuedAt: string;
  expiresAt?: string;
  createdBy: UserId;
  version: number;
}
/** Client-supplied draft. Identity, lifecycle and issuance time are server-owned. */
export type NewCertificate = Omit<Certificate, "id" | "publicToken" | "status" | "version" | "createdBy" | "issuedAt">;
/** Complete record passed from the authorized use case to persistence. */
export type CertificateCreateRecord = Omit<Certificate, "id" | "status" | "version" | "issuedAt">;
export interface PublicCertificate {
  code: string;
  kind: CertificateKind;
  value: CertificateValue;
  title: string;
  description?: string;
  recipientName?: string;
  giftDate?: string;
  greetingText?: string;
  senderSignature?: string;
  status: CertificateStatus;
  issuedAt: string;
  expiresAt?: string;
}
