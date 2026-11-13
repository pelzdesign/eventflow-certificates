import type { Certificate, CertificateCreateRecord, OrganizationId, PublicCertificate, PublicToken } from "../domain/certificate.js";
export interface CertificateRepositoryPort {
  create(certificate: CertificateCreateRecord): Promise<Certificate>;
  findByPublicToken(token: PublicToken): Promise<PublicCertificate | null>;
  listByOrganization(input: { organizationId: OrganizationId; limit: number; /** Opaque cursor returned by the previous page's final certificate ID. */ cursor?: string }): Promise<Certificate[]>;
}
