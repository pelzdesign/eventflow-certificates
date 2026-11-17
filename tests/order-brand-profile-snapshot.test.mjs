import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../dist-functions/functions/api/orders/index.js';

test('new orders snapshot the current organization contact instead of a stale service contact', async () => {
  const writes = [];
  const env = {
    DEMO_ORGANIZATION_ID: 'demo-org',
    DEMO_USER_ID: 'demo-user',
    DEMO_LOGIN_USERNAME: 'demo',
    DEMO_LOGIN_PASSWORD: 'demo-password',
    CERTIFICATES_DB: {
      prepare(sql) {
        const statement = { values: [] };
        statement.bind = (...values) => { statement.values = values; return statement; };
        statement.first = async () => {
          if (sql.includes('FROM catalog_variants')) {
            return {
              service_id: 'service-1',
              service_title: 'Услуга',
              service_description: 'Описание услуги',
              variant_id: 'variant-1',
              variant_title: 'Основной вариант',
              variant_description: 'Описание варианта',
              amount_minor: 490000,
              currency: 'RUB',
              activation_url: 'https://old.example/contact'
            };
          }
          if (sql.includes('FROM organization_brand_profiles')) {
            return {
              display_name: 'Demo Brand',
              provider_name: 'Demo Specialist',
              tagline: 'Описание',
              contact_url: 'https://new.example/contact'
            };
          }
          return null;
        };
        statement.run = async () => {
          writes.push({ sql, values: statement.values });
          return { success: true, meta: { changes: 1 } };
        };
        return statement;
      }
    }
  };
  const request = new Request('https://preview.example/api/orders', {
    method: 'POST',
    headers: { Origin: 'https://preview.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantId: 'variant-1' })
  });
  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 201);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].values[10], 'https://new.example/contact');
});
