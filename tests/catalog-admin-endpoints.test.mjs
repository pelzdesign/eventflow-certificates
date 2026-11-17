import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost, onRequestPut } from '../dist-functions/functions/api/catalog/admin.js';

function setup() {
  return {
    env: {
      CERTIFICATES_DB: { prepare() { return { bind() { return this; }, async first() { return null; } }; } },
      DEMO_USER_ID: 'demo-user',
      DEMO_ORGANIZATION_ID: 'demo-org',
      DEMO_LOGIN_USERNAME: 'demo',
      DEMO_LOGIN_PASSWORD: 'demo-password'
    }
  };
}

test('seller catalog endpoint requires an authenticated seller session', async () => {
  const { env } = setup();
  const response = await onRequestGet({
    request: new Request('https://preview.example/api/catalog/admin'),
    env
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'AUTHENTICATION_REQUIRED' });
});

test('seller catalog updates reject foreign origins before processing a write', async () => {
  const { env } = setup();
  const response = await onRequestPut({
    request: new Request('https://preview.example/api/catalog/admin', {
      method: 'PUT',
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }),
    env
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'ORIGIN_NOT_ALLOWED' });
});

test('seller service creation rejects foreign origins before processing a write', async () => {
  const { env } = setup();
  const response = await onRequestPost({
    request: new Request('https://preview.example/api/catalog/admin', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }),
    env
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'ORIGIN_NOT_ALLOWED' });
});

test('seller service creation requires an authenticated seller session', async () => {
  const { env } = setup();
  const response = await onRequestPost({
    request: new Request('https://preview.example/api/catalog/admin', {
      method: 'POST',
      headers: { Origin: 'https://preview.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Новая услуга',
        initialVariant: { title: 'Стандарт', amountMinor: 500000, currency: 'RUB' }
      })
    }),
    env
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'AUTHENTICATION_REQUIRED' });
});

test('authenticated seller can create an organization-scoped service with its first active variant', async () => {
  const token = 'valid-demo-session-token';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const writes = [];
  const env = {
    DEMO_USER_ID: 'demo-user',
    DEMO_ORGANIZATION_ID: 'demo-org',
    DEMO_LOGIN_USERNAME: 'demo',
    DEMO_LOGIN_PASSWORD: 'demo-password',
    CERTIFICATES_DB: {
      prepare(sql) {
        const statement = { sql, values: [] };
        statement.bind = (...values) => { statement.values = values; return statement; };
        statement.first = async () => sql.includes('FROM demo_sessions')
          ? { token_hash: tokenHash, user_id: 'demo-user', organization_id: 'demo-org', expires_at: new Date(Date.now() + 60_000).toISOString() }
          : null;
        statement.all = async () => ({ results: [] });
        statement.run = async () => { writes.push({ sql, values: statement.values }); return { success: true }; };
        return statement;
      }
    }
  };
  const response = await onRequestPost({
    request: new Request('https://preview.example/api/catalog/admin', {
      method: 'POST',
      headers: {
        Origin: 'https://preview.example',
        Cookie: '__Host-ef-cert-session=' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Индивидуальная консультация',
        description: 'Персональная работа со специалистом',
        category: 'Консультации',
        initialVariant: {
          title: 'Стандартная консультация',
          description: 'Одна встреча',
          amountMinor: 500000,
          currency: 'RUB'
        }
      })
    }),
    env
  });
  assert.equal(response.status, 201);
  assert.equal(writes.length, 3);
  assert.match(writes[0].sql, /INSERT INTO catalog_services/);
  assert.equal(writes[0].values[1], 'demo-org');
  assert.equal(writes[0].values[6], 'https://vk.me/pelts_tatyana_vastu');
  assert.match(writes[0].sql, /VALUES \(\?, \?, \?, \?, \?, \?, \?, 0, 0, \?, \?\)/);
  assert.match(writes[1].sql, /INSERT INTO catalog_variants/);
  assert.equal(writes[1].values[4], 500000);
  assert.equal(writes[1].values[5], 'RUB');
  assert.match(writes[2].sql, /UPDATE catalog_services SET is_active = 1/);
});
