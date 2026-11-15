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
