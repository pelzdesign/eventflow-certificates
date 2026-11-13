import test from 'node:test';
import assert from 'node:assert/strict';
import { issueCertificate } from '../dist/application/issue-certificate.js';
import { readPublicCertificate } from '../dist/application/read-public-certificate.js';

const draft = {
  organizationId: 'org-demo',
  code: 'GIFT-001',
  kind: 'service',
  value: { kind: 'service', description: 'One consultation' },
  title: 'Consultation gift certificate',
};

function dependencies(overrides = {}) {
  const calls = { permission: null, created: null, tokenCalls: 0 };
  const deps = {
    access: {
      async getAuthenticatedActor() { return { userId: 'user-from-server' }; },
      async assertOrganizationPermission(input) { calls.permission = input; },
    },
    repository: {
      async create(input) {
        calls.created = input;
        return { ...input, id: 'cert-1', status: 'active', issuedAt: '2026-11-13T00:00:00.000Z', version: 1 };
      },
      async findByPublicToken() { return null; },
      async listByOrganization() { return []; },
    },
    tokens: { newToken() { calls.tokenCalls += 1; return 'server-generated-token'; } },
    calls,
    ...overrides,
  };
  return deps;
}

test('issue resolves actor and checks organization permission before persistence', async () => {
  const deps = dependencies();
  const result = await issueCertificate({ certificate: draft }, deps);
  assert.equal(deps.calls.permission.actor.userId, 'user-from-server');
  assert.equal(deps.calls.permission.organizationId, 'org-demo');
  assert.equal(deps.calls.permission.permission, 'certificate:issue');
  assert.equal(deps.calls.created.createdBy, 'user-from-server');
  assert.equal(deps.calls.created.publicToken, 'server-generated-token');
  assert.equal(result.status, 'active');
});

test('issue rejects unauthenticated requests without writing', async () => {
  const deps = dependencies({ access: { async getAuthenticatedActor() { return null; }, async assertOrganizationPermission() { assert.fail('must not authorize'); } } });
  await assert.rejects(issueCertificate({ certificate: draft }, deps), /AUTHENTICATION_REQUIRED/);
  assert.equal(deps.calls.created, null);
});

test('issue rejects invalid monetary values', async () => {
  const deps = dependencies();
  const invalid = { ...draft, kind: 'monetary', value: { kind: 'monetary', amountMinor: 0, currency: 'RUB' } };
  await assert.rejects(issueCertificate({ certificate: invalid }, deps), /INVALID_MONETARY_AMOUNT/);
  assert.equal(deps.calls.created, null);
});

test('public lookup returns repository projection and does not invoke state changes', async () => {
  const publicRecord = { code: 'GIFT-001', kind: 'service', value: draft.value, title: draft.title, status: 'active', issuedAt: '2026-11-13T00:00:00.000Z' };
  let lookups = 0;
  const repository = {
    async findByPublicToken(token) { lookups += 1; assert.equal(token, 'public-token'); return publicRecord; },
    async create() { assert.fail('public lookup must not create'); },
    async listByOrganization() { assert.fail('public lookup must not list'); },
  };
  assert.equal(await readPublicCertificate('public-token', { repository }), publicRecord);
  assert.equal(lookups, 1);
  assert.equal(await readPublicCertificate(' ', { repository }), null);
});
