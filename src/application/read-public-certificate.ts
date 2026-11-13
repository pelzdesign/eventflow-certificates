import type { PublicCertificate, PublicToken } from "../domain/certificate.js";
import type { CertificateRepositoryPort } from "../ports/certificate-repository.js";

export interface ReadPublicCertificateDependencies {
  repository: CertificateRepositoryPort;
}

/** Read-only public lookup. This use case must never mutate certificate state. */
export async function readPublicCertificate(
  token: PublicToken,
  dependencies: ReadPublicCertificateDependencies,
): Promise<PublicCertificate | null> {
  if (!token.trim()) {
    return null;
  }

  return dependencies.repository.findByPublicToken(token);
}
