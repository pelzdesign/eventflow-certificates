import { issueCertificate } from "../../../src/application/issue-certificate.js";
import { D1CertificateRepository } from "../../../src/adapters/cloudflare/d1-certificate-repository.js";
import type { NewCertificate, Certificate } from "../../../src/domain/certificate.js";
import { DemoPlatformAccess, demoConfigurationReady, getDemoSession, jsonResponse, sameOrigin, type CertificatesEnv } from "../_shared.js";
interface PagesContext { request: Request; env: CertificatesEnv; }

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const {request,env}=context;
  if(!demoConfigurationReady(env))return jsonResponse({error:"DEMO_NOT_CONFIGURED"},503);
  const session=await getDemoSession(request,env);
  if(!session)return jsonResponse({error:"AUTHENTICATION_REQUIRED"},401);
  const access=new DemoPlatformAccess(request,env);
  try{
    await access.assertOrganizationPermission({actor:{userId:session.userId},organizationId:session.organizationId,permission:"certificate:read"});
    const url=new URL(request.url),query=(url.searchParams.get("q")??"").trim().toLocaleLowerCase("ru").slice(0,120),status=url.searchParams.get("status")??"all";
    const allowed=new Set(["all","active","redeemed","cancelled","expired"]);
    if(!allowed.has(status))return jsonResponse({error:"INVALID_STATUS_FILTER"},400);
    const repository=new D1CertificateRepository(env.CERTIFICATES_DB,{newId:()=>crypto.randomUUID()},{now:()=>new Date()});
    const rows=await repository.listByOrganization({organizationId:session.organizationId,limit:100});
    const filtered=rows.filter(c=>(!query||[c.code,c.title,c.recipientName??""].some(v=>v.toLocaleLowerCase("ru").includes(query)))&&(status==="all"||c.status===status));
    return jsonResponse({certificates:filtered.map(toCabinetRecord),limit:100});
  }catch(error){
    if(error instanceof Error&&error.message==="ORGANIZATION_ACCESS_DENIED")return jsonResponse({error:"ORGANIZATION_ACCESS_DENIED"},403);
    return jsonResponse({error:"CERTIFICATE_LIST_FAILED"},500);
  }
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const {request,env}=context;
  if(!demoConfigurationReady(env))return jsonResponse({error:"DEMO_NOT_CONFIGURED"},503);
  if(!sameOrigin(request))return jsonResponse({error:"ORIGIN_NOT_ALLOWED"},403);
  const session=await getDemoSession(request,env);
  if(!session)return jsonResponse({error:"AUTHENTICATION_REQUIRED"},401);
  let body:unknown;
  try{const raw=await request.text();if(raw.length>12000)return jsonResponse({error:"REQUEST_TOO_LARGE"},413);body=JSON.parse(raw);}
  catch{return jsonResponse({error:"INVALID_JSON"},400);}
  let certificate:NewCertificate;
  try{certificate=parseDraft(body,session.organizationId);}
  catch(error){return jsonResponse({error:error instanceof Error?error.message:"INVALID_CERTIFICATE"},400);}
  try{
    const repository=new D1CertificateRepository(env.CERTIFICATES_DB,{newId:()=>crypto.randomUUID()},{now:()=>new Date()});
    const issued=await issueCertificate({certificate},{access:new DemoPlatformAccess(request,env),repository,tokens:{newToken:()=>crypto.randomUUID().replaceAll("-","")}});
    return jsonResponse({certificate:toCabinetRecord(issued)},201);
  }catch(error){
    const code=error instanceof Error?error.message:"INTERNAL_ERROR";
    if(code==="AUTHENTICATION_REQUIRED")return jsonResponse({error:code},401);
    if(code==="ORGANIZATION_ACCESS_DENIED")return jsonResponse({error:code},403);
    return jsonResponse({error:"CERTIFICATE_ISSUE_FAILED"},500);
  }
}

function toCabinetRecord(c:Certificate){
  return {id:c.id,code:c.code,kind:c.kind,value:c.value,title:c.title,description:c.description??null,
    recipientName:c.recipientName??null,recipientEmail:c.recipientEmail??null,status:c.status,issuedAt:c.issuedAt,
    expiresAt:c.expiresAt??null,publicUrl:`/certificates/${c.publicToken}`};
}
function parseDraft(value:unknown,organizationId:string):NewCertificate{
  if(!isRecord(value))throw new Error("INVALID_CERTIFICATE_BODY");
  const code=requiredString(value.code,"CERTIFICATE_CODE_REQUIRED"),title=requiredString(value.title,"CERTIFICATE_TITLE_REQUIRED"),kind=value.kind;
  if(kind!=="service"&&kind!=="monetary")throw new Error("INVALID_CERTIFICATE_KIND");
  if(!isRecord(value.value)||value.value.kind!==kind)throw new Error("INVALID_CERTIFICATE_VALUE");
  let certificateValue:NewCertificate["value"];
  if(kind==="service")certificateValue={kind,description:requiredString(value.value.description,"SERVICE_DESCRIPTION_REQUIRED")};
  else{
    const amountMinor=value.value.amountMinor,currency=requiredString(value.value.currency,"INVALID_CURRENCY_CODE");
    if(typeof amountMinor!=="number"||!Number.isSafeInteger(amountMinor)||amountMinor<=0)throw new Error("INVALID_MONETARY_AMOUNT");
    if(!/^[A-Z]{3}$/.test(currency))throw new Error("INVALID_CURRENCY_CODE");
    certificateValue={kind,amountMinor,currency};
  }
  const draft:NewCertificate={organizationId,code,title,kind,value:certificateValue};
  assignOptionalString(draft,"description",value.description);
  assignOptionalString(draft,"recipientName",value.recipientName);
  assignOptionalString(draft,"recipientEmail",value.recipientEmail);
  assignOptionalString(draft,"expiresAt",value.expiresAt);
  return draft;
}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value);}
function requiredString(value:unknown,errorCode:string):string{if(typeof value!=="string"||!value.trim())throw new Error(errorCode);return value.trim();}
function assignOptionalString<K extends "description"|"recipientName"|"recipientEmail"|"expiresAt">(target:NewCertificate,key:K,value:unknown):void{
  if(value===undefined||value===null||value==="")return;
  if(typeof value!=="string")throw new Error(`INVALID_${key.replace(/[A-Z]/g,l=>`_${l}`).toUpperCase()}`);
  target[key]=value.trim();
}
