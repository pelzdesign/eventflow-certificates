import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoPlatformAccess } from '../dist-functions/functions/api/_shared.js';
import { D1DemoSessionStore, createDemoSession } from '../dist/adapters/cloudflare/d1-demo-session-store.js';

class SessionDb {
  sessions = new Map();
  prepare(sql) {
    const db = this;
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async run() {
        if (sql.includes('INSERT INTO demo_sessions')) {
          db.sessions.set(values[0], {
            token_hash: values[0], user_id: values[1],
            organization_id: values[2], expires_at: values[3],
          });
        }
        return { success: true, meta: { changes: 1 } };
      },
      async first() {
        if (sql.includes('FROM demo_sessions')) return db.sessions.get(values[0]) ?? null;
        return null;
      },
    };
  }
}

test('DEMO adapter grants only explicit issue/read/redeem/revoke permissions to the session organization', async () => {
  const db = new SessionDb();
  const env = {
    CERTIFICATES_DB: db,
    DEMO_USER_ID: 'demo-user',
    DEMO_ORGANIZATION_ID: 'demo-org',
    DEMO_LOGIN_USERNAME: 'demo',
    DEMO_LOGIN_PASSWORD: 'not-a-real-password',
  };
  const session = await createDemoSession(new D1DemoSessionStore(db), {
    userId: env.DEMO_USER_ID,
    organizationId: env.DEMO_ORGANIZATION_ID,
  });
  const request = new Request('https://preview.example/cabinet', {
    headers: { Cookie: session.cookie.split(';')[0] },
  });
  const access = new DemoPlatformAccess(request, env);
  const actor = { userId: env.DEMO_USER_ID };

  for (const permission of [
    'certificate:issue',
    'certificate:read',
    'certificate:redeem',
    'certificate:revoke_public_link',
  ]) {
    await assert.doesNotReject(() => access.assertOrganizationPermission({
      actor, organizationId: env.DEMO_ORGANIZATION_ID, permission,
    }));
  }

  for (const permission of ['certificate:edit', 'certificate:cancel']) {
    await assert.rejects(() => access.assertOrganizationPermission({
      actor, organizationId: env.DEMO_ORGANIZATION_ID, permission,
    }), /ORGANIZATION_ACCESS_DENIED/);
  }

  await assert.rejects(() => access.assertOrganizationPermission({
    actor, organizationId: 'another-org', permission: 'certificate:redeem',
  }), /ORGANIZATION_ACCESS_DENIED/);
});
