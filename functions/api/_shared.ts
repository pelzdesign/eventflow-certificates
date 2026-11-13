import type { D1DatabasePort } from "../../src/adapters/cloudflare/d1-certificate-repository.js";
import { D1DemoSessionStore, assertSameOrigin, resolveDemoSession, sha256, type DemoSessionRecord } from "../../src/adapters/cloudflare/d1-demo-session-store.js";
import type { AuthenticatedActor, CertificatePermission, PlatformAccessPort } from "../../src/ports/platform-access.js";
export interface CertificatesEnv {
  CERTIFICATES_DB:D1DatabasePort; DEMO_USER_ID?:string; DEMO_ORGANIZATION_ID?:string;
  DEMO_LOGIN_USERNAME?:string; DEMO_LOGIN_PASSWORD?:string;
}
export function sessionStore(env:CertificatesEnv):D1DemoSessionStore{return new D1DemoSessionStore(env.CERTIFICATES_DB);}
export async function getDemoSession(request:Request,env:CertificatesEnv):Promise<DemoSessionRecord|null>{
  if(!env.CERTIFICATES_DB)return null;return resolveDemoSession(request,sessionStore(env));
}
export class DemoPlatformAccess implements PlatformAccessPort{
  constructor(private readonly request:Request,private readonly env:CertificatesEnv){}
  async getAuthenticatedActor():Promise<AuthenticatedActor|null>{
    const s=await getDemoSession(this.request,this.env);
    if(!s||s.userId!==this.env.DEMO_USER_ID||s.organizationId!==this.env.DEMO_ORGANIZATION_ID)return null;
    return {userId:s.userId};
  }
  async assertOrganizationPermission(input:{actor:AuthenticatedActor;organizationId:string;permission:CertificatePermission}):Promise<void>{
    const s=await getDemoSession(this.request,this.env),allowed=input.permission==="certificate:issue"||input.permission==="certificate:read";
    if(!s||!allowed||s.userId!==input.actor.userId||s.userId!==this.env.DEMO_USER_ID||
      s.organizationId!==this.env.DEMO_ORGANIZATION_ID||input.organizationId!==s.organizationId)throw new Error("ORGANIZATION_ACCESS_DENIED");
  }
}
export function demoConfigurationReady(env:CertificatesEnv):boolean{
  return Boolean(env.CERTIFICATES_DB&&env.DEMO_USER_ID&&env.DEMO_ORGANIZATION_ID&&env.DEMO_LOGIN_USERNAME&&env.DEMO_LOGIN_PASSWORD);
}
export function jsonResponse(body:unknown,status=200,extraHeaders:HeadersInit={}):Response{
  const headers=new Headers(extraHeaders);headers.set("Cache-Control","no-store");headers.set("Content-Type","application/json; charset=utf-8");
  return new Response(JSON.stringify(body),{status,headers});
}
export function htmlResponse(html:string,status=200,extraHeaders:HeadersInit={}):Response{
  const headers=new Headers(extraHeaders);headers.set("Content-Type","text/html; charset=utf-8");headers.set("Cache-Control","no-store");
  headers.set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  headers.set("Referrer-Policy","no-referrer");headers.set("X-Content-Type-Options","nosniff");headers.set("X-Frame-Options","DENY");
  return new Response(html,{status,headers});
}
export function sameOrigin(request:Request):boolean{return assertSameOrigin(request);}
export async function allowLoginAttempt(request:Request,env:CertificatesEnv):Promise<boolean>{
  const password=env.DEMO_LOGIN_PASSWORD;if(!password)return false;
  const now=Date.now(),windowMs=15*60*1000,windowStart=new Date(Math.floor(now/windowMs)*windowMs).toISOString();
  const ip=request.headers.get("CF-Connecting-IP")??"unknown",keyHash=await sha256(`${password}:login:${ip}`),store=sessionStore(env);
  const attempts=await store.consumeLoginAttempt(keyHash,windowStart);
  await store.pruneLoginAttempts(new Date(now-24*60*60*1000).toISOString());
  return attempts<=5;
}
export function constantTimeEqual(left:string,right:string):boolean{
  const a=new TextEncoder().encode(left),b=new TextEncoder().encode(right),length=Math.max(a.length,b.length);let difference=a.length^b.length;
  for(let i=0;i<length;i++)difference|=(a[i]??0)^(b[i]??0);
  return difference===0;
}
