import type { OrganizationId, UserId } from "../domain/certificate.js";

export type CertificatePermission =
  | "certificate:issue"
  | "certificate:read"
  | "certificate:edit"
  | "certificate:redeem"
  | "certificate:revoke_public_link"
  | "certificate:cancel";

export interface AuthenticatedActor {
  /** User identity resolved from a trusted server-side session, never from request JSON. */
  userId: UserId;
}

export interface PlatformAccessPort {
  getAuthenticatedActor(): Promise<AuthenticatedActor | null>;

  assertOrganizationPermission(input: {
    actor: AuthenticatedActor;
    organizationId: OrganizationId;
    permission: CertificatePermission;
  }): Promise<void>;
}
