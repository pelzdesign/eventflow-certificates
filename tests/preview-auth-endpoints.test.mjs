import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as loginPost } from '../dist-functions/functions/api/auth/login.js';
import { onRequestPost as issuePost } from '../dist-functions/functions/api/certificates/index.js';
import { loginRateLimitWindowStart } from '../dist-functions/functions/api/_shared.js';

class MemoryD1 {
  sessions = new Map();
  attempts = new Map();
  certificates = [];
  prepare(sql) {
    const query = sql.replace(/\s+/g, ' ').trim();
    let values = [];
    const db = this;
    return {
      bind(...args) { values = args; return this; },
      async first() {
        if (query.includes('INSERT INTO demo_login_attempts')) {
          const key = values[0] + ':' + values[1];
          const count = (db.attempts.get(key) || 0) + 1;
          db.attempts.set(key, count);
          return { attempts: count };
        }
        if (query.includes('FROM demo_sessions')) return db.sessions.get(values[0]) || null;
        return null;
      },
      async run() {
        if (query.includes('INSERT INTO demo_sessions')) {
          db.sessions.set(values[0], { token_hash: values[0], user_id: values[1], organization_id: values[2], expires_at: values[3] });
        } else if (query.includes('DELETE FROM demo_sessions')) {
          db.sessions.delete(values[0]);
        } else if (query.includes('INSERT INTO certificates')) {
          db.certificates.push({
            id: values[0], organization_id: values[1], public_token: values[2], code: values[3],
            kind: values[4], value_json: values[5], title: values[6], description: values[7],
            recipient_name: values[8], recipient_email: values[9], gift_date: values[10],
            greeting_text: values[11], sender_signature: values[12], activation_url: values[13],
            activation_requested_at: values[14], public_access_revoked_at: values[15], status: values[16],
            issued_at: values[17], expires_at: values[18], created_by: values[19], version: values[20]
          });
        } else if (query.includes('DELETE FROM demo_login_attempts')) {
          for (const key of db.attempts.keys()) if (key.endsWith(':' + values[0])) db.attempts.delete(key);
        }
        return { success: true, meta: { changes: 1 } };
      },
      async all() {
        if (query.includes('FROM certificates')) {
          const org = values[0], limit = values[4];
          return { success: true, results: db.certificates.filter(x => x.organization_id === org).slice(0, limit) };
        }
        return { success: true, results: [] };
      }
    };
  }
}

function setup() {
  return {
    db: new MemoryD1(),
    env: {
      CERTIFICATES_DB: null,
      DEMO_USER_ID: 'trusted-demo-user',
      DEMO_ORGANIZATION_ID: 'trusted-demo-org',
      DEMO_LOGIN_USERNAME: 'preview-user',
      DEMO_LOGIN_PASSWORD: 'correct-horse-battery'
    }
  };
}
function loginRequest(body, origin = 'https://preview.example') {
  return new Request('https://preview.example/api/auth/login', {
    method: 'POST',
    headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
    body: JSON.stringify(body)
  });
}
async function authenticate(env, db) {
  env.CERTIFICATES_DB = db;
  const response = await loginPost({ request: loginRequest({ username: 'preview-user', password: 'correct-horse-battery' }), env });
  assert.equal(response.status, 200);
  return response.headers.get('Set-Cookie').split(';')[0];
}

test('login endpoint rejects missing and foreign Origin headers', async () => {
  const { db, env } = setup(); env.CERTIFICATES_DB = db;
  const missing = await loginPost({ request: loginRequest({ username: 'preview-user', password: 'correct-horse-battery' }, null), env });
  const foreign = await loginPost({ request: loginRequest({ username: 'preview-user', password: 'correct-horse-battery' }, 'https://attacker.example'), env });
  assert.equal(missing.status, 403);
  assert.equal(foreign.status, 403);
});

test('login endpoint rejects invalid credentials', async () => {
  const { db, env } = setup(); env.CERTIFICATES_DB = db;
  const response = await loginPost({ request: loginRequest({ username: 'preview-user', password: 'wrong-password' }), env });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'INVALID_CREDENTIALS' });
  assert.equal(db.sessions.size, 0);
});

test('login endpoint rate-limits the sixth attempt in the same fixed window', async () => {
  const { db, env } = setup(); env.CERTIFICATES_DB = db;
  const responses = [];
  for (let i = 0; i < 6; i++) {
    responses.push(await loginPost({ request: loginRequest({ username: 'preview-user', password: 'wrong-password' }), env }));
  }
  assert.deepEqual(responses.map(x => x.status), [401, 401, 401, 401, 401, 429]);
});

test('fixed rate-limit window resets exactly at a 15-minute UTC bucket boundary', () => {
  const before = Date.parse('2026-11-13T12:14:59.999Z');
  const boundary = Date.parse('2026-11-13T12:15:00.000Z');
  assert.equal(loginRateLimitWindowStart(before), '2026-11-13T12:00:00.000Z');
  assert.equal(loginRateLimitWindowStart(boundary), '2026-11-13T12:15:00.000Z');
  assert.notEqual(loginRateLimitWindowStart(before), loginRateLimitWindowStart(boundary));
});

test('successful login sets an opaque secure cookie and stores only its hash', async () => {
  const { db, env } = setup(); env.CERTIFICATES_DB = db;
  const response = await loginPost({ request: loginRequest({ username: 'preview-user', password: 'correct-horse-battery' }), env });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('Set-Cookie');
  assert.match(cookie, /^__Host-ef-cert-session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.equal(db.sessions.size, 1);
  const stored = [...db.sessions.values()][0];
  assert.notEqual(stored.token_hash, cookie.split(';')[0].split('=')[1]);
  assert.equal(stored.user_id, 'trusted-demo-user');
  assert.equal(stored.organization_id, 'trusted-demo-org');
  const body = await response.json();
  assert.equal(body.authenticated, true);
  assert.equal('userId' in body, false);
  assert.equal('organizationId' in body, false);
});

test('certificate issuance ignores client-supplied actor and organization identifiers', async () => {
  const { db, env } = setup(); env.CERTIFICATES_DB = db;
  const cookie = await authenticate(env, db);
  const request = new Request('https://preview.example/api/certificates', {
    method: 'POST',
    headers: { Origin: 'https://preview.example', Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'GIFT-TEST-01', title: 'Тестовый сертификат', kind: 'service',
      value: { kind: 'service', description: 'Тестовая услуга' },
      organizationId: 'attacker-org', userId: 'attacker-user', actorId: 'attacker-user', createdBy: 'attacker-user'
    })
  });
  const response = await issuePost({ request, env });
  assert.equal(response.status, 201);
  assert.equal(db.certificates.length, 1);
  assert.equal(db.certificates[0].organization_id, 'trusted-demo-org');
  assert.equal(db.certificates[0].created_by, 'trusted-demo-user');
  assert.equal(db.certificates[0].code, 'GIFT-TEST-01');
});
