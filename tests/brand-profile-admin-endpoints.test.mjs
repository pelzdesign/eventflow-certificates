import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPut } from '../dist-functions/functions/api/brand-profile/admin.js';
import { loadBrandProfile, normalizeEditableBrandProfile } from '../dist-functions/functions/brand-profile.js';
import { VASTU_BRAND_PROFILE } from '../dist-functions/functions/vastu-brand.js';

const token = 'valid-brand-profile-session';
const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
function setup(authenticated = true) {
  let profileRow = null;
  const writes = [];
  const env = {
    DEMO_USER_ID: 'demo-user', DEMO_ORGANIZATION_ID: 'demo-org',
    DEMO_LOGIN_USERNAME: 'demo', DEMO_LOGIN_PASSWORD: 'demo-password',
    CERTIFICATES_DB: {
      prepare(sql) {
        const statement = { values: [] };
        statement.bind = (...values) => { statement.values = values; return statement; };
        statement.first = async () => {
          if (sql.includes('FROM demo_sessions')) return authenticated
            ? { token_hash: tokenHash, user_id: 'demo-user', organization_id: 'demo-org', expires_at: new Date(Date.now() + 60_000).toISOString() }
            : null;
          if (sql.includes('FROM organization_brand_profiles')) return profileRow;
          return null;
        };
        statement.run = async () => {
          writes.push({ sql, values: statement.values });
          if (sql.includes('INSERT INTO organization_brand_profiles')) profileRow = {
            display_name: statement.values[1], provider_name: statement.values[2],
            tagline: statement.values[3], contact_url: statement.values[4]
          };
          return { success: true, meta: { changes: 1 } };
        };
        return statement;
      }
    }
  };
  return { env, writes, getProfileRow: () => profileRow };
}
function request(path, method = 'GET', body, origin = 'https://preview.example') {
  return new Request('https://preview.example' + path, {
    method, headers: {
      Origin: origin, Cookie: '__Host-ef-cert-session=' + token,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}
test('brand profile endpoint requires an authenticated seller session', async () => {
  const { env } = setup(false);
  const response = await onRequestGet({ request: request('/api/brand-profile/admin'), env });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'AUTHENTICATION_REQUIRED' });
});
test('brand profile writes reject foreign origins before processing the payload', async () => {
  const { env, writes } = setup();
  const response = await onRequestPut({ request: request('/api/brand-profile/admin', 'PUT', {}, 'https://attacker.example'), env });
  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
});
test('seller can update only the permitted content fields for the session organization', async () => {
  const { env, writes, getProfileRow } = setup();
  const response = await onRequestPut({ request: request('/api/brand-profile/admin', 'PUT', {
    providerName: 'Татьяна Пельц', tagline: 'Помогаю сделать дом поддерживающим пространством.',
    contactUrl: 'https://example.com/contact'
  }), env });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.saved, true);
  assert.equal(data.profile.providerName, 'Татьяна Пельц');
  assert.equal(data.profile.tagline, 'Помогаю сделать дом поддерживающим пространством.');
  assert.equal(data.profile.contactUrl, 'https://example.com/contact');
  assert.equal(getProfileRow().display_name, VASTU_BRAND_PROFILE.displayName);
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /ON CONFLICT\(organization_id\) DO UPDATE/);
  assert.equal(writes[0].values[0], 'demo-org');
});
test('brand profile rejects unsafe URLs and attempts to edit EventFlow-owned fields', () => {
  assert.equal(normalizeEditableBrandProfile({ providerName: 'Специалист', tagline: 'Описание', contactUrl: 'javascript:alert(1)' }), null);
  assert.equal(normalizeEditableBrandProfile({ displayName: 'Другой бренд', providerName: 'Специалист', tagline: 'Описание', contactUrl: 'https://example.com' }), null);
  assert.equal(normalizeEditableBrandProfile({ providerName: 'x'.repeat(121), tagline: 'Описание', contactUrl: 'https://example.com' }), null);
});
test('brand profile resolver overlays stored content and keeps EventFlow visual settings', async () => {
  const database = {
    prepare() {
      return { bind() { return this; }, async first() {
        return { display_name: 'Demo Brand', provider_name: 'Demo Specialist', tagline: 'Current tagline', contact_url: 'https://example.com/contact' };
      } };
    }
  };
  const profile = await loadBrandProfile(database, 'demo-org', VASTU_BRAND_PROFILE);
  assert.equal(profile.displayName, 'Demo Brand');
  assert.equal(profile.providerName, 'Demo Specialist');
  assert.equal(profile.tagline, 'Current tagline');
  assert.equal(profile.contactUrl, 'https://example.com/contact');
  assert.deepEqual(profile.theme, VASTU_BRAND_PROFILE.theme);
  assert.deepEqual(profile.giftStory, VASTU_BRAND_PROFILE.giftStory);
});
