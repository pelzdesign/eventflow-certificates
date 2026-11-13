import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoSession,resolveDemoSession,revokeDemoSession,sha256,DEMO_SESSION_TTL_SECONDS} from '../dist/adapters/cloudflare/d1-demo-session-store.js';
function fakeStore(){const rows=new Map();return {rows,async create(x){rows.set(x.tokenHash,x)},async find(x){return rows.get(x)??null},async delete(x){rows.delete(x)},async consumeLoginAttempt(){return 1},async pruneLoginAttempts(){}}}
test('session cookie is opaque, host-only, secure and backed by a token hash',async()=>{
 const store=fakeStore(),result=await createDemoSession(store,{userId:'demo-user',organizationId:'demo-org'},1000);
 assert.match(result.cookie,/__Host-ef-cert-session=/);assert.match(result.cookie,/HttpOnly/);assert.match(result.cookie,/Secure/);assert.match(result.cookie,/SameSite=Strict/);assert.match(result.cookie,/Path=\//);
 assert.equal(Date.parse(result.expiresAt),1000+DEMO_SESSION_TTL_SECONDS*1000);
 const id=result.cookie.split(';')[0].split('=')[1];assert.equal(id.length,43);assert.equal([...store.rows.keys()][0],await sha256(id));
});
test('session resolves from cookie and logout revokes the server record',async()=>{
 const store=fakeStore(),result=await createDemoSession(store,{userId:'demo-user',organizationId:'demo-org'},1000),id=result.cookie.split(';')[0].split('=')[1];
 const request=new Request('https://preview.example/cabinet',{headers:{Cookie:`__Host-ef-cert-session=${id}`}});
 assert.equal((await resolveDemoSession(request,store,2000)).userId,'demo-user');
 await revokeDemoSession(request,store);assert.equal(await resolveDemoSession(request,store,2000),null);
});
test('expired sessions are deleted and rejected',async()=>{
 const store=fakeStore(),result=await createDemoSession(store,{userId:'demo-user',organizationId:'demo-org'},1000),id=result.cookie.split(';')[0].split('=')[1];
 const request=new Request('https://preview.example/cabinet',{headers:{Cookie:`__Host-ef-cert-session=${id}`}});
 assert.equal(await resolveDemoSession(request,store,1000+(DEMO_SESSION_TTL_SECONDS+1)*1000),null);assert.equal(store.rows.size,0);
});
