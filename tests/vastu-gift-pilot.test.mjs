import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapVastuCatalog, onRequestPost } from '../dist-functions/functions/api/catalog-bootstrap.js';
import { VASTU_BRAND_PROFILE, VASTU_DEMO_CATALOG_ITEM } from '../dist-functions/functions/vastu-brand.js';
import { renderPublicCertificatePage } from '../dist/presentation/public-certificate-page.js';

class BootstrapDb {
  statements = [];
  prepare(sql) {
    const statement = { sql, values: [] };
    statement.bind = (...values) => {
      statement.values = values;
      return statement;
    };
    return statement;
  }
  async batch(statements) {
    this.statements.push(...statements);
    return [];
  }
}

test('Vastu pilot catalogue bootstrap inserts one service and one variant for the DEMO organization', async () => {
  const db = new BootstrapDb();
  await bootstrapVastuCatalog(db, 'demo-org', '2026-11-15T12:00:00.000Z');
  assert.equal(db.statements.length, 2);
  assert.match(db.statements[0].sql, /INSERT OR IGNORE INTO catalog_services/);
  assert.match(db.statements[0].sql, /activation_url/);
  assert.equal(db.statements[0].values[5], VASTU_DEMO_CATALOG_ITEM.activationUrl);
  assert.match(db.statements[1].sql, /INSERT OR IGNORE INTO catalog_variants/);
  assert.equal(db.statements[0].values[1], 'demo-org');
  assert.equal(db.statements[1].values[4], 490000);
  assert.equal(db.statements[1].values[5], 'RUB');
  assert.equal(db.statements[1].values[1], VASTU_DEMO_CATALOG_ITEM.serviceId);
});

test('catalog bootstrap endpoint is same-origin protected and idempotent by SQL contract', async () => {
  const db = new BootstrapDb();
  const env = {
    CERTIFICATES_DB: db,
    DEMO_USER_ID: 'demo-user',
    DEMO_ORGANIZATION_ID: 'demo-org',
    DEMO_LOGIN_USERNAME: 'demo',
    DEMO_LOGIN_PASSWORD: 'not-a-real-password',
  };
  const blocked = await onRequestPost({
    request: new Request('https://certificates.example/api/catalog-bootstrap', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' },
    }),
    env,
  });
  assert.equal(blocked.status, 403);
  assert.equal(db.statements.length, 0);

  const response = await onRequestPost({
    request: new Request('https://certificates.example/api/catalog-bootstrap', {
      method: 'POST',
      headers: { Origin: 'https://certificates.example' },
    }),
    env,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { initialized: true });
  assert.equal(db.statements.length, 2);
});

test('Vastu public certificate uses the brand profile without exposing the purchase price', () => {
  const html = renderPublicCertificatePage({
    code: 'VASTU-001',
    kind: 'service',
    value: { kind: 'service', description: 'Персональный экспресс-разбор' },
    title: 'Экспресс-разбор пространства по Васту',
    description: VASTU_DEMO_CATALOG_ITEM.variantDescription,
    recipientName: 'Анна',
    greetingText: 'Пусть дома будет тепло и спокойно.',
    senderSignature: 'Илья',
    status: 'active',
    issuedAt: '2026-11-15T12:00:00.000Z',
    activationUrl: VASTU_BRAND_PROFILE.contactUrl,
  }, 'a'.repeat(64), VASTU_BRAND_PROFILE);

  assert.match(html, /PelzDesign \| пространство по васту/);
  assert.match(html, /Подарок, который помогает по-новому почувствовать свой дом/);
  assert.match(html, /персональная карта Васту в PDF/);
  assert.match(html, /Активировать подарок/);
  assert.doesNotMatch(html, /4\s?900/);
  assert.doesNotMatch(html, /₽/);
});
