import type { D1DatabasePort } from "./d1-certificate-repository.js";
export interface DemoSessionRecord { tokenHash: string; userId: string; organizationId: string; expiresAt: string; }
export interface DemoSessionStore {
  create(record: DemoSessionRecord): Promise<void>;
  find(tokenHash: string): Promise<DemoSessionRecord | null>;
  delete(tokenHash: string): Promise<void>;
  consumeLoginAttempt(keyHash: string, windowStart: string): Promise<number>;
  pruneLoginAttempts(before: string): Promise<void>;
}
export class D1DemoSessionStore implements DemoSessionStore {
  constructor(private readonly database: D1DatabasePort) {}
  async create(record: DemoSessionRecord): Promise<void> {
    await this.database.prepare("INSERT INTO demo_sessions (token_hash, user_id, organization_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(record.tokenHash, record.userId, record.organizationId, record.expiresAt, new Date().toISOString()).run();
  }
  async find(tokenHash: string): Promise<DemoSessionRecord | null> {
    const row = await this.database.prepare("SELECT token_hash, user_id, organization_id, expires_at FROM demo_sessions WHERE token_hash = ? LIMIT 1")
      .bind(tokenHash).first<{token_hash:string;user_id:string;organization_id:string;expires_at:string}>();
    return row ? {tokenHash:row.token_hash,userId:row.user_id,organizationId:row.organization_id,expiresAt:row.expires_at} : null;
  }
  async delete(tokenHash: string): Promise<void> {
    await this.database.prepare("DELETE FROM demo_sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  async consumeLoginAttempt(keyHash: string, windowStart: string): Promise<number> {
    const row = await this.database.prepare(`
      INSERT INTO demo_login_attempts (key_hash, window_start, attempts) VALUES (?, ?, 1)
      ON CONFLICT(key_hash, window_start) DO UPDATE SET attempts = attempts + 1
      RETURNING attempts
    `).bind(keyHash,windowStart).first<{attempts:number}>();
    return row?.attempts ?? Number.MAX_SAFE_INTEGER;
  }
  async pruneLoginAttempts(before: string): Promise<void> {
    await this.database.prepare("DELETE FROM demo_login_attempts WHERE window_start < ?").bind(before).run();
  }
}
const SESSION_COOKIE="__Host-ef-cert-session";
export const DEMO_SESSION_TTL_SECONDS=8*60*60;
export async function sha256(value:string):Promise<string>{
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export async function createDemoSession(store:DemoSessionStore,input:{userId:string;organizationId:string},now=Date.now()):Promise<{cookie:string;expiresAt:string}>{
  const random=new Uint8Array(32);crypto.getRandomValues(random);
  let binary="";for(const byte of random)binary+=String.fromCharCode(byte);
  const sessionId=btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  const expiresAt=new Date(now+DEMO_SESSION_TTL_SECONDS*1000).toISOString();
  await store.create({tokenHash:await sha256(sessionId),userId:input.userId,organizationId:input.organizationId,expiresAt});
  return {cookie:`${SESSION_COOKIE}=${sessionId}; Max-Age=${DEMO_SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`,expiresAt};
}
export async function resolveDemoSession(request:Request,store:DemoSessionStore,now=Date.now()):Promise<DemoSessionRecord|null>{
  const id=readCookie(request.headers.get("Cookie")??"",SESSION_COOKIE);
  if(!id||id.length>128)return null;
  const hash=await sha256(id),session=await store.find(hash);
  if(!session)return null;
  if(Date.parse(session.expiresAt)<=now){await store.delete(hash);return null;}
  return session;
}
export async function revokeDemoSession(request:Request,store:DemoSessionStore):Promise<void>{
  const id=readCookie(request.headers.get("Cookie")??"",SESSION_COOKIE);
  if(id&&id.length<=128)await store.delete(await sha256(id));
}
export function expiredSessionCookie():string{return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;}
export function assertSameOrigin(request:Request):boolean{
  const origin=request.headers.get("Origin");if(!origin)return false;
  try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}
function readCookie(header:string,name:string):string|null{
  for(const part of header.split(";")){const i=part.indexOf("=");if(i>=0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim()||null;}
  return null;
}
