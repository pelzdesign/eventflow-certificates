import type {
  Certificate,
  CertificateCreateRecord,
  CertificateKind,
  CertificateStatus,
  CertificateValue,
  OrganizationId,
  PublicCertificate,
  PublicToken,
} from "../../domain/certificate.js";
import type { CertificateRepositoryPort } from "../../ports/certificate-repository.js";
import type { ClockPort, IdGeneratorPort } from "../../ports/runtime.js";

interface D1Result<T> { results?: T[]; success: boolean; meta?: { changes?: number }; }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}
export interface D1DatabasePort { prepare(query: string): D1PreparedStatement; }

interface CertificateRow {
  id: string;
  organization_id: string;
  public_token: string;
  code: string;
  kind: CertificateKind;
  value_json: string;
  title: string;
  description: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  gift_date: string | null;
  greeting_text: string | null;
  sender_signature: string | null;
  activation_url: string | null;
  activation_requested_at: string | null;
  public_access_revoked_at: string | null;
  status: CertificateStatus;
  issued_at: string;
  expires_at: string | null;
  created_by: string;
  version: number;
}

export class D1CertificateRepository implements CertificateRepositoryPort {
  constructor(
    private readonly database: D1DatabasePort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async create(input: CertificateCreateRecord): Promise<Certificate> {
    const certificate: Certificate = {
      ...input,
      id: this.ids.newId(),
      status: "active",
      issuedAt: this.clock.now().toISOString(),
      version: 1,
    };

    await this.database.prepare(`
      INSERT INTO certificates (
        id, organization_id, public_token, code, kind, value_json, title,
        description, recipient_name, recipient_email, gift_date, greeting_text, sender_signature,
        activation_url, activation_requested_at, public_access_revoked_at,
        status, issued_at, expires_at, created_by, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      certificate.id,
      certificate.organizationId,
      certificate.publicToken,
      certificate.code,
      certificate.kind,
      JSON.stringify(certificate.value),
      certificate.title,
      certificate.description ?? null,
      certificate.recipientName ?? null,
      certificate.recipientEmail ?? null,
      certificate.giftDate ?? null,
      certificate.greetingText ?? null,
      certificate.senderSignature ?? null,
      certificate.activationUrl ?? null,
      certificate.activationRequestedAt ?? null,
      certificate.publicAccessRevokedAt ?? null,
      certificate.status,
      certificate.issuedAt,
      certificate.expiresAt ?? null,
      certificate.createdBy,
      certificate.version,
    ).run();

    return certificate;
  }

  async findByPublicToken(token: PublicToken): Promise<PublicCertificate | null> {
    const row = await this.database.prepare(`
      SELECT code, kind, value_json, title, description, recipient_name,
             gift_date, greeting_text, sender_signature, activation_url, activation_requested_at,
             status, issued_at, expires_at
      FROM certificates WHERE public_token = ? AND public_access_revoked_at IS NULL LIMIT 1
    `).bind(token).first<Pick<CertificateRow,
      "code" | "kind" | "value_json" | "title" | "description" |
      "recipient_name" | "gift_date" | "greeting_text" | "sender_signature" | "activation_url" | "activation_requested_at" | "status" | "issued_at" | "expires_at"
    >>();

    if (!row) return null;
    const certificate: PublicCertificate = {
      code: row.code,
      kind: row.kind,
      value: JSON.parse(row.value_json) as CertificateValue,
      title: row.title,
      status: row.status,
      issuedAt: row.issued_at,
    };
    if (row.description !== null) certificate.description = row.description;
    if (row.recipient_name !== null) certificate.recipientName = row.recipient_name;
    if (typeof row.gift_date === "string") certificate.giftDate = row.gift_date;
    if (typeof row.greeting_text === "string") certificate.greetingText = row.greeting_text;
    if (typeof row.sender_signature === "string") certificate.senderSignature = row.sender_signature;
    if (typeof row.activation_url === "string") certificate.activationUrl = row.activation_url;
    if (typeof row.activation_requested_at === "string") certificate.activationRequestedAt = row.activation_requested_at;
    if (row.expires_at !== null) certificate.expiresAt = row.expires_at;
    return certificate;
  }

  async listByOrganization(input: { organizationId: OrganizationId; limit: number; cursor?: string }): Promise<Certificate[]> {
    const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
    const cursor = input.cursor ?? null;
    const result = await this.database.prepare(`
      SELECT * FROM certificates
      WHERE organization_id = ?
        AND (? IS NULL OR (issued_at, id) < (
          SELECT issued_at, id FROM certificates
          WHERE id = ? AND organization_id = ?
        ))
      ORDER BY issued_at DESC, id DESC
      LIMIT ?
    `).bind(input.organizationId, cursor, cursor, input.organizationId, limit).all<CertificateRow>();
    return (result.results ?? []).map(mapCertificateRow);
  }
}

function mapCertificateRow(row: CertificateRow): Certificate {
  const certificate: Certificate = {
    id: row.id,
    organizationId: row.organization_id,
    publicToken: row.public_token,
    code: row.code,
    kind: row.kind,
    value: JSON.parse(row.value_json) as CertificateValue,
    title: row.title,
    status: row.status,
    issuedAt: row.issued_at,
    createdBy: row.created_by,
    version: row.version,
  };
  if (row.description !== null) certificate.description = row.description;
  if (row.recipient_name !== null) certificate.recipientName = row.recipient_name;
  if (row.recipient_email !== null) certificate.recipientEmail = row.recipient_email;
  if (typeof row.gift_date === "string") certificate.giftDate = row.gift_date;
  if (typeof row.greeting_text === "string") certificate.greetingText = row.greeting_text;
  if (typeof row.sender_signature === "string") certificate.senderSignature = row.sender_signature;
  if (typeof row.activation_url === "string") certificate.activationUrl = row.activation_url;
  if (typeof row.activation_requested_at === "string") certificate.activationRequestedAt = row.activation_requested_at;
  if (row.public_access_revoked_at !== null) certificate.publicAccessRevokedAt = row.public_access_revoked_at;
  if (row.expires_at !== null) certificate.expiresAt = row.expires_at;
  return certificate;
}
