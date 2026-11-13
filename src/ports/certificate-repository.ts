import type {
  Certificate,
  OrganizationId,
  PublicCertificate,
  PublicToken,
} from "../domain/certificate.js";

export interface CertificateRepositoryPort {
  create(certificate: Omit<Certificate, "id" | "publicToken" | "status" | "version"> & {
    publicToken: PublicToken;
  }): Promise<Certificate>;

  findByPublicToken(token: PublicToken): Promise<PublicCertificate | null>;

  listByOrganization(input: {
    organizationId: OrganizationId;
    limit: number;
    cursor?: string;
  }): Promise<Certificate[]>;
}
