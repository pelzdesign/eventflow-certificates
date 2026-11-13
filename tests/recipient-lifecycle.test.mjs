import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as activate } from '../dist-functions/functions/api/public/certificates/[token]/activate.js';

class ActivationDb {
  row = {
    activation_url: 'https://vk.me/tatyana_vastu',
    status: 'active',
    expires_at: null,
    public_access_revoked_at: null,
    activation_requested_at: null,
  };
  updates = 0;
  prepare(sql) {
    const db = this;
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() { return { ...db.row }; },
      async run() {
        db.updates += 1;
        db.row.activation_requested_at ??= values[0];
        return { success: true, meta: { changes: 1 } };
      },
    };
  }
}

function context(db, { origin = 'https://certificates.example', token = 'a'.repeat(64) } = {}) {
  return {
    request: new Request('https://certificates.example/api/public/certificates/' + token + '/activate', {
      method: 'POST',
      headers: origin ? { Origin: origin } : {},
    }),
    params: { token },
    env: { CERTIFICATES_DB: db },
  };
}

test('recipient activation records first activation and redirects directly to the specialist', async () => {
  const db = new ActivationDb();
  const response = await activate(context(db));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), 'https://vk.me/tatyana_vastu');
  assert.ok(db.row.activation_requested_at);
  assert.equal(db.updates, 1);
});

test('opening or attempting activation without same-origin protection cannot mutate state', async () => {
  const db = new ActivationDb();
  const response = await activate(context(db, { origin: 'https://attacker.example' }));
  assert.equal(response.status, 403);
  assert.equal(db.updates, 0);
});

test('revoked, expired and inactive certificates cannot be activated', async () => {
  const db = new ActivationDb();
  db.row.public_access_revoked_at = '2026-11-14T00:00:00.000Z';
  const revoked = await activate(context(db));
  assert.equal(revoked.status, 404);
  assert.equal(db.updates, 0);

  db.row.public_access_revoked_at = null;
  db.row.status = 'redeemed';
  const used = await activate(context(db));
  assert.equal(used.status, 409);
  assert.equal(db.updates, 0);
});

test('unsafe activation destinations are rejected', async () => {
  const db = new ActivationDb();
  db.row.activation_url = 'javascript:alert(1)';
  const response = await activate(context(db));
  assert.equal(response.status, 500);
  assert.equal(db.updates, 0);
});
