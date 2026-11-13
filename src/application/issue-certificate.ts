import type { Certificate, NewCertificate } from "../domain/certificate.js";
import type { CertificateRepositoryPort } from "../ports/certificate-repository.js";
import type { PlatformAccessPort } from "../ports/platform-access.js";
import type { PublicTokenGeneratorPort } from "../ports/runtime.js";
export interface IssueCertificateInput { certificate: NewCertificate; }
export interface IssueCertificateDependencies { access: PlatformAccessPort; repository: CertificateRepositoryPort; tokens: PublicTokenGeneratorPort; }
export async function issueCertificate(input: IssueCertificateInput, dependencies: IssueCertificateDependencies): Promise<Certificate> {
  const actor = await dependencies.access.getAuthenticatedActor();
  if (!actor) throw new Error("AUTHENTICATION_REQUIRED");
  await dependencies.access.assertOrganizationPermission({ actor, organizationId: input.certificate.organizationId, permission: "certificate:issue" });
  validateCertificateDraft(input.certificate);
  return dependencies.repository.create({ ...input.certificate, createdBy: actor.userId, publicToken: dependencies.tokens.newToken() });
}
function validateCertificateDraft(draft: NewCertificate): void {
  if (!draft.organizationId.trim()) throw new Error("ORGANIZATION_REQUIRED");
  if (!draft.code.trim()) throw new Error("CERTIFICATE_CODE_REQUIRED");
  if (!draft.title.trim()) throw new Error("CERTIFICATE_TITLE_REQUIRED");
  if (draft.value.kind === "monetary") {
    if (!Number.isSafeInteger(draft.value.amountMinor) || draft.value.amountMinor <= 0) throw new Error("INVALID_MONETARY_AMOUNT");
    if (!/^[A-Z]{3}$/.test(draft.value.currency)) throw new Error("INVALID_CURRENCY_CODE");
  } else if (!draft.value.description.trim()) throw new Error("SERVICE_DESCRIPTION_REQUIRED");
}
