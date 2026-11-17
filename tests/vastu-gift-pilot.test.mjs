import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapVastuCatalog, onRequestPost } from '../dist-functions/functions/api/catalog-bootstrap.js';
import { VASTU_BRAND_PROFILE, VASTU_DEMO_CATALOG_ITEM } from '../dist-functions/functions/vastu-brand.js';
import { normalizeOrderPersonalization } from '../dist-functions/functions/api/orders/[token].js';
import { onRequestGet as renderDemoPreview } from '../dist-functions/functions/demo-preview.js';
import { VASTU_DEMO_PERSONALIZATION } from '../dist-functions/functions/vastu-brand.js';
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
  assert.equal(db.statements.length, 3);
  assert.match(db.statements[0].sql, /INSERT OR IGNORE INTO organization_brand_profiles/);
  assert.equal(db.statements[0].values[0], 'demo-org');
  assert.equal(db.statements[0].values[1], VASTU_BRAND_PROFILE.displayName);
  assert.equal(db.statements[0].values[4], VASTU_BRAND_PROFILE.contactUrl);
  assert.match(db.statements[1].sql, /INSERT OR IGNORE INTO catalog_services/);
  assert.match(db.statements[1].sql, /activation_url/);
  assert.equal(db.statements[1].values[5], VASTU_DEMO_CATALOG_ITEM.activationUrl);
  assert.match(db.statements[2].sql, /INSERT OR IGNORE INTO catalog_variants/);
  assert.equal(db.statements[1].values[1], 'demo-org');
  assert.equal(db.statements[2].values[4], 490000);
  assert.equal(db.statements[2].values[5], 'RUB');
  assert.equal(db.statements[2].values[1], VASTU_DEMO_CATALOG_ITEM.serviceId);
});

class LegacyBootstrapDb extends BootstrapDb {
  async batch(statements) {
    if (statements.some(statement => statement.sql.includes('organization_brand_profiles'))) {
      throw new Error('no such table: organization_brand_profiles');
    }
    return super.batch(statements);
  }
}

test('catalog bootstrap still seeds the pilot catalogue before migration 0006 is applied', async () => {
  const db = new LegacyBootstrapDb();
  await bootstrapVastuCatalog(db, 'demo-org', '2026-11-15T12:00:00.000Z');
  assert.equal(db.statements.length, 2);
  assert.match(db.statements[0].sql, /INSERT OR IGNORE INTO catalog_services/);
  assert.match(db.statements[1].sql, /INSERT OR IGNORE INTO catalog_variants/);
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
  assert.equal(db.statements.length, 3);
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

  assert.doesNotMatch(html, /Услугу оказывает Васту-специалист Пельц Татьяна/);
  assert.match(html, /Платформа EventFlow Certificates/);
  assert.match(html, /Подарок ещё не активирован/);
  assert.match(html, /PelzDesign \| пространство по васту/);
  assert.match(html, /Дом, который поддерживает/);
  assert.match(html, /Подарок, который помогает по-новому почувствовать свой дом/);
  assert.match(html, /Место, где начинается ваша жизнь/);
  assert.match(html, /Персональная Васту-карта/);
  assert.match(html, /Голосовой разбор/);
  assert.match(html, /Практические рекомендации/);
  assert.match(html, /Этот подарок для/);
  assert.match(html, /href=\"#gift-stage-3\"/);
  assert.match(html, /Индивидуальная карта вашего пространства в PDF/);
  assert.match(html, /Активировать подарок/);
  assert.doesNotMatch(html, /4\s?900/);
  assert.doesNotMatch(html, /₽/);
});

test('Vastu story keeps gift activation as an explicit POST and does not expose internal purchase data', () => {
  const html = renderPublicCertificatePage({
    code: 'VASTU-002',
    kind: 'service',
    value: { kind: 'service', description: 'Персональный экспресс-разбор' },
    title: 'Экспресс-разбор пространства по Васту',
    description: VASTU_DEMO_CATALOG_ITEM.variantDescription,
    recipientName: 'Илья и Анна',
    greetingText: 'Пусть ваш дом будет местом силы.',
    senderSignature: 'С теплом, друзья',
    status: 'active',
    issuedAt: '2026-11-15T12:00:00.000Z',
    activationUrl: VASTU_BRAND_PROFILE.contactUrl,
  }, 'b'.repeat(64), VASTU_BRAND_PROFILE);

  assert.match(html, /method="post"/);
  assert.match(html, /api\/public\/certificates\/[a-f0-9]{64}\/activate/);
  assert.match(html, /Активировать подарок/);
  assert.match(html, /Персональный экспресс-разбор/);
  assert.doesNotMatch(html, /4\s?900/);
  assert.doesNotMatch(html, /₽/);
});

test('brand-neutral certificate rendering remains available without a custom gift story', () => {
  const html = renderPublicCertificatePage({
    code: 'GENERIC-001',
    kind: 'service',
    value: { kind: 'service', description: 'Консультация' },
    title: 'Подарочный сертификат',
    status: 'active',
    issuedAt: '2026-11-15T12:00:00.000Z',
  });

  assert.match(html, /Подарочный сертификат/);
  assert.match(html, /Консультация/);
  assert.doesNotMatch(html, /Дом, который поддерживает/);
});


test('DEMO order starts with a ready-made, editable Vastu gift example', () => {
  assert.equal(VASTU_DEMO_PERSONALIZATION.recipientName, 'Илья и Анна');
  assert.match(VASTU_DEMO_PERSONALIZATION.greetingText, /Пусть ваш дом будет местом/);
  assert.equal(VASTU_DEMO_PERSONALIZATION.senderSignature, 'С теплом, ваши друзья');
});

test('gift personalization fields are optional and can all be cleared before issuance', () => {
  assert.deepEqual(normalizeOrderPersonalization({
    certificateDate: '',
    recipientName: '',
    greetingText: '',
    senderSignature: '',
  }), {
    certificateDate: null,
    recipientName: null,
    greetingText: null,
    senderSignature: null,
  });
});

test('gift personalization still validates supplied values and field limits', () => {
  assert.equal(normalizeOrderPersonalization({ certificateDate: 'not-a-date' }), null);
  assert.equal(normalizeOrderPersonalization({ recipientName: 'x'.repeat(181) }), null);
  assert.equal(normalizeOrderPersonalization({ greetingText: 'x'.repeat(2001) }), null);
  assert.equal(normalizeOrderPersonalization({ senderSignature: 'x'.repeat(181) }), null);
  assert.deepEqual(normalizeOrderPersonalization({
    certificateDate: '2026-11-16',
    recipientName: 'Анна',
    greetingText: 'С праздником!',
    senderSignature: 'Илья',
  }), {
    certificateDate: '2026-11-16',
    recipientName: 'Анна',
    greetingText: 'С праздником!',
    senderSignature: 'Илья',
  });
});


test('instant Vastu demo preview is read-only and creates no activation or payment action', async () => {
  const response = await renderDemoPreview({
    env: {
      DEMO_ORGANIZATION_ID: 'demo-org',
      CERTIFICATES_DB: {
        prepare() { return { bind() { return this; }, async first() { return null; } }; }
      }
    }
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Дом, который поддерживает/);
  assert.match(html, /Илья и Анна/);
  assert.match(html, /Активировать подарок/);
  assert.match(html, /контакт специалиста/);
  assert.match(html, /https:\/\/vk\.me\/pelts_tatyana_vastu/);
  assert.doesNotMatch(html, /method="post"/);
  assert.doesNotMatch(html, /4\s?900/);
  assert.doesNotMatch(html, /Истёк/);
});
