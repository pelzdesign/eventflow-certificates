import { readPublicCertificate } from "../../src/application/read-public-certificate.js";
import { D1CertificateRepository } from "../../src/adapters/cloudflare/d1-certificate-repository.js";
import { renderPublicCertificatePage } from "../../src/presentation/public-certificate-page.js";
import type { CertificatesEnv } from "../api/_shared.js";

interface PagesContext {
  params: { token?: string };
  env: CertificatesEnv;
}

const NOT_FOUND_PAGE = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Сертификат не найден</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f2ec;color:#24231f;font-family:Arial,sans-serif;text-align:center}main{max-width:420px}h1{font:400 32px Georgia,serif}p{color:#77736b;line-height:1.6}</style></head><body><main><h1>Сертификат не найден</h1><p>Проверьте ссылку или обратитесь к организации, которая выдала сертификат.</p></main></body></html>`;
const ERROR_PAGE = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Не удалось открыть сертификат</title></head><body><main><h1>Не удалось открыть сертификат</h1><p>Попробуйте открыть ссылку позднее.</p></main></body></html>`;

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const token = context.params.token ?? "";
  if (!token) return htmlResponse(NOT_FOUND_PAGE, 404);

  try {
    const repository = new D1CertificateRepository(
      context.env.CERTIFICATES_DB,
      { newId: () => crypto.randomUUID() },
      { now: () => new Date() },
    );
    const certificate = await readPublicCertificate(token, { repository });
    if (!certificate) return htmlResponse(NOT_FOUND_PAGE, 404);
    return htmlResponse(renderPublicCertificatePage(certificate), 200);
  } catch {
    return htmlResponse(ERROR_PAGE, 500);
  }
}

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
