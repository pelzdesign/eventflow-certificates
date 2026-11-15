import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPut } from '../dist-functions/functions/api/catalog/admin.js';

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
