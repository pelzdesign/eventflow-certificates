import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as issueOrder } from '../dist-functions/functions/api/orders/[token]/issue.js';

class IssuanceDb {
  order = {
    id: 'order-1',
    organization_id: 'demo-org',
    service_title_snapshot: 'Васту-консультация',
    variant_title_snapshot: 'Квартира',
    description_snapshot: 'Персональный разбор',
    amount_minor: 1688000,
    currency: 'RUB',
    payment_status: 'confirmed',
    certificate_date: '2027-06-10',
    recipient_name: 'Старое имя',
    greeting_text: 'Старое поздравление',
    sender_signature: 'Старая подпись',
    activation_url: 'https://example.com/contact',
    certificate_id: null,
    issuance_status: 'not_started',
  };
  insertedCertificate = null;

  prepare(sql) {
    const db = this;
    let values = [];
    return {
      sql,
      bind(...args) { values = args; this.values = values; return this; },
      async first() {
        if (sql.includes('FROM gift_orders WHERE public_token')) {
          const snapshot = { ...db.order };
          // Simulate a buyer saving new personalization after the handler's
          // preliminary SELECT but before the atomic D1 batch executes.
          db.order = {
            ...db.order,
            certificate_date: '2027-06-11',
            recipient_name: 'Актуальное имя',
            greeting_text: 'Актуальное поздравление',
            sender_signature: 'Актуальная подпись',
          };
          return snapshot;
        }
        return null;
      },
    };
  }

  async batch(statements) {
    const [insert, update] = statements;
    assert.match(insert.sql, /recipient_name, NULL,\s*certificate_date, greeting_text, sender_signature/);
    assert.match(insert.sql, /FROM gift_orders/);
    const values = insert.values;
    this.insertedCertificate = {
      id: values[0],
      organization_id: values[1],
      recipient_name: this.order.recipient_name,
      gift_date: this.order.certificate_date,
      greeting_text: this.order.greeting_text,
      sender_signature: this.order.sender_signature,
    };
    this.order.certificate_id = update.values[0];
    this.order.issuance_status = 'issued';
    return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
  }
}

test('issuance snapshots the latest personalization inside the atomic D1 batch', async () => {
  const db = new IssuanceDb();
  const token = 'a'.repeat(64);
  const request = new Request(`https://preview.example/api/orders/${token}/issue`, {
    method: 'POST',
    headers: { Origin: 'https://preview.example' },
  });
  const response = await issueOrder({
    request,
    params: { token },
    env: {
      CERTIFICATES_DB: db,
      DEMO_USER_ID: 'demo-user',
      DEMO_ORGANIZATION_ID: 'demo-org',
      DEMO_LOGIN_USERNAME: 'demo',
      DEMO_LOGIN_PASSWORD: 'not-a-real-password',
    },
  });

  assert.equal(response.status, 201);
  assert.equal(db.insertedCertificate.recipient_name, 'Актуальное имя');
  assert.equal(db.insertedCertificate.gift_date, '2027-06-11');
  assert.equal(db.insertedCertificate.greeting_text, 'Актуальное поздравление');
  assert.equal(db.insertedCertificate.sender_signature, 'Актуальная подпись');
});
