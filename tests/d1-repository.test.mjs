import test from 'node:test';
import assert from 'node:assert/strict';
import { D1CertificateRepository } from '../dist/adapters/cloudflare/d1-certificate-repository.js';

class FakeStatement {
  constructor(database, sql) { this.database = database; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { this.database.last = { sql: this.sql, values: this.values }; return { success: true, meta: { changes: 1 } }; }
  async first() { return this.database.row ?? null; }
  async all() { return { success: true, results: this.database.rows ?? [] }; }
}
class FakeDatabase {
  prepare(sql) { return new FakeStatement(this, sql); }
}

test('D1 repository creates active records with server-generated lifecycle fields', async () => {
  const db = new FakeDatabase();
  const repository = new D1CertificateRepository(db, { newId: () => 'server-id' }, { now: () => new Date('2026-11-13T12:00:00.000Z') });
  const created = await repository.create({
    organizationId: 'org-demo', publicToken: 'token-from-server', code: 'C-001',
    kind: 'service', value: { kind: 'service', description: 'Consultation' },
    title: 'Consultation', createdBy: 'trusted-user',
  });
  assert.equal(created.id, 'server-id');
  assert.equal(created.status, 'active');
  assert.equal(created.version, 1);
  assert.equal(created.issuedAt, '2026-11-13T12:00:00.000Z');
  assert.match(db.last.sql, /INSERT INTO certificates/);
  assert.equal(db.last.values[0], 'server-id');
  assert.equal(db.last.values[1], 'org-demo');
  assert.equal(db.last.values[19], 'trusted-user');
  assert.equal(db.last.values.length, 21);
});

test('public repository projection does not expose organization, issuer or recipient email', async () => {
  const db = new FakeDatabase();
  db.row = {
    code: 'C-001', kind: 'service', value_json: JSON.stringify({ kind: 'service', description: 'Consultation' }),
    title: 'Consultation', description: null, recipient_name: 'Guest', status: 'active',
    issued_at: '2026-11-13T12:00:00.000Z', expires_at: null,
  };
  const repository = new D1CertificateRepository(db, { newId: () => 'id' }, { now: () => new Date() });
  const publicRecord = await repository.findByPublicToken('public-token');
  assert.match(db.last.sql, /public_access_revoked_at IS NULL/);
  assert.deepEqual(publicRecord, {
    code: 'C-001', kind: 'service', value: { kind: 'service', description: 'Consultation' },
    title: 'Consultation', status: 'active', issuedAt: '2026-11-13T12:00:00.000Z', recipientName: 'Guest',
  });
  assert.equal('recipientEmail' in publicRecord, false);
  assert.equal('createdBy' in publicRecord, false);
  assert.equal('organizationId' in publicRecord, false);
});
