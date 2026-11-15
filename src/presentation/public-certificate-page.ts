import type { PublicCertificate } from "../domain/certificate.js";
import { DEFAULT_BRAND_PROFILE, type BrandProfile } from "./brand-profile.js";

const STATUS_LABELS: Record<PublicCertificate["status"], string> = {
  active: "Действителен",
  redeemed: "Подарок использован",
  cancelled: "Отменён",
  expired: "Истёк",
};

const STATUS_CLASSES: Record<PublicCertificate["status"], string> = {
  active: "status-active",
  redeemed: "status-muted",
  cancelled: "status-muted",
  expired: "status-muted",
};

/** Render a public, read-only certificate page. All record-supplied text is escaped. */
export function renderPublicCertificatePage(
  certificate: PublicCertificate,
  publicToken?: string,
  brand: BrandProfile = DEFAULT_BRAND_PROFILE,
): string {
  const brandName = escapeHtml(brand.displayName);
  const brandTagline = escapeHtml(brand.tagline);
  const value = certificate.value.kind === "service"
    ? `<p class="value">${escapeHtml(certificate.value.description)}</p>`
    : `<p class="value">${escapeHtml(formatMinorCurrency(certificate.value.amountMinor, certificate.value.currency))}</p>`;

  const description = certificate.description
    ? `<p class="description">${escapeHtml(certificate.description)}</p>`
    : "";
  const recipient = certificate.recipientName
    ? `<p class="recipient"><span>Получатель</span>${escapeHtml(certificate.recipientName)}</p>`
    : "";
  const greeting = certificate.greetingText
    ? `<p class="greeting">${escapeHtml(certificate.greetingText)}</p>`
    : "";
  const signature = certificate.senderSignature
    ? `<p class="signature">${escapeHtml(certificate.senderSignature)}</p>`
    : "";
  const giftDate = certificate.giftDate
    ? `<p class="date-row"><span>Дата подарка</span><time datetime="${escapeHtml(certificate.giftDate)}">${escapeHtml(formatDate(certificate.giftDate))}</time></p>`
    : "";
  const expiry = certificate.expiresAt
    ? `<p class="date-row"><span>Действует до</span><time datetime="${escapeHtml(certificate.expiresAt)}">${escapeHtml(formatDate(certificate.expiresAt))}</time></p>`
    : "";

  const certificateExpired = Boolean(certificate.expiresAt && new Date(certificate.expiresAt).getTime() <= Date.now());
  const displayStatus = certificateExpired ? "Истёк" : STATUS_LABELS[certificate.status];
  const displayStatusClass = certificateExpired ? "status-muted" : STATUS_CLASSES[certificate.status];
  const activation = certificate.status === "active" && !certificateExpired && certificate.activationUrl && publicToken
    ? `<section class="activation">
        <p class="activation-note">${certificate.activationRequestedAt ? "Вы уже начали активацию подарка. Можно продолжить общение со специалистом." : "Чтобы воспользоваться подарком, свяжитесь со специалистом."}</p>
        <form method="post" action="/api/public/certificates/${escapeHtml(publicToken)}/activate">
          <button type="submit">${certificate.activationRequestedAt ? "Написать специалисту" : "Активировать подарок"}</button>
        </form>
      </section>`
    : certificate.status === "redeemed"
      ? `<p class="used-note">Этот подарок уже подарил свои впечатления. Спасибо, что воспользовались им!</p>`
      : "";


  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#f5f2ec">
  <title>${escapeHtml(certificate.title)} — ${brandName}</title>
  <style>
    :root{color-scheme:light;--ink:${escapeHtml(brand.theme.ink)};--muted:${escapeHtml(brand.theme.muted)};--paper:${escapeHtml(brand.theme.surface)};--line:${escapeHtml(brand.theme.line)};--accent:${escapeHtml(brand.theme.accent)};--accent-ink:${escapeHtml(brand.theme.accentInk)};--page:${escapeHtml(brand.theme.page)}}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;padding:32px 18px;display:grid;place-items:center;background:var(--page);color:var(--ink);font-family:Arial,Helvetica,sans-serif}
    main{width:min(100%,560px)}
    .eyebrow{margin:0 0 14px;text-align:center;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
    .card{position:relative;overflow:hidden;padding:clamp(28px,7vw,56px);background:var(--paper);border:1px solid var(--line);box-shadow:0 18px 60px #30281912}
    .card:before,.card:after{position:absolute;left:0;width:100%;height:1px;background:var(--line);content:""}
    .card:before{top:12px}.card:after{bottom:12px}
    h1{margin:0 0 12px;text-align:center;font-family:Georgia,serif;font-size:clamp(28px,6vw,42px);font-weight:400;line-height:1.15}
    .code{margin:0;text-align:center;color:var(--muted);font-size:12px;letter-spacing:.12em}
    .status{display:table;margin:28px auto 30px;padding:8px 13px;border-radius:999px;font-size:12px;font-weight:700}
    .status-active{background:#e8efe7;color:#38543d}.status-muted{background:#efede8;color:#69655d}
    .value{margin:0;text-align:center;font-family:Georgia,serif;font-size:clamp(19px,4vw,25px);line-height:1.45}
    .description{margin:16px 0 0;text-align:center;color:var(--muted);font-size:14px;line-height:1.65}
    .recipient{margin:28px 0 0;text-align:center;font-size:16px}
    .greeting{margin:24px auto 0;max-width:420px;text-align:center;white-space:pre-wrap;font-family:Georgia,serif;font-size:16px;line-height:1.7}
    .signature{margin:20px 0 0;text-align:right;font-family:Georgia,serif;font-style:italic;font-size:16px}
    .recipient span{display:block;margin-bottom:6px;color:var(--muted);font-size:11px;letter-spacing:.1em;text-transform:uppercase}
    .dates{margin-top:32px;padding-top:20px;border-top:1px solid var(--line)}
    .date-row{display:flex;justify-content:space-between;gap:16px;margin:8px 0;font-size:12px}
    .date-row span{color:var(--muted)}
    .opening{width:min(100%,560px);margin:auto}
    .opening>summary{list-style:none;cursor:pointer;min-height:420px;padding:52px 28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;background:linear-gradient(145deg,#fffefa,#eee8dc);border:1px solid var(--line);box-shadow:0 18px 60px #30281912}
    .opening>summary::-webkit-details-marker{display:none}
    .opening-title{font:400 clamp(30px,7vw,44px) Georgia,serif;line-height:1.2;max-width:380px}
    .seal{width:76px;height:76px;border:1px solid #b9a77f;border-radius:50%;display:grid;place-items:center;color:#9a835e;font:32px Georgia,serif}
    .opening-action{display:inline-block;margin-top:14px;padding:14px 24px;border:1px solid #8b7958;border-radius:3px;color:#5c503c;font-size:12px;letter-spacing:.12em;text-transform:uppercase}
    .opening[open]>summary{display:none}
    .gift-content{animation:reveal .75s ease both}
    @keyframes reveal{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    .activation{margin:28px auto 0;text-align:center}
    .activation-note,.used-note{color:var(--muted);font-size:13px;line-height:1.6;text-align:center}
    .activation button{margin-top:12px;padding:15px 24px;border:0;border-radius:4px;background:var(--accent);color:var(--accent-ink);font:600 12px Arial,sans-serif;letter-spacing:.08em;cursor:pointer}
    .used-note{margin-top:28px;padding:16px;border-top:1px solid var(--line)}
    @media(prefers-reduced-motion:reduce){.gift-content{animation:none}}
    footer{margin:20px 0 0;text-align:center;color:var(--muted);font-size:11px;line-height:1.5}
    @media(max-width:420px){body{padding:20px 12px}.date-row{font-size:11px}}
  </style>
</head>
<body>
  <main>
    <details class="opening">
      <summary>
        <span class="eyebrow">Небольшой сюрприз для вас</span>
        <span class="seal" aria-hidden="true">✦</span>
        <span class="opening-title">Для вас приготовили особенный подарок</span>
        <span class="opening-action">Открыть подарок</span>
      </summary>
      <div class="gift-content">
        <p class="eyebrow">${brandName}</p><p class="description">${brandTagline}</p>
        <section class="card" aria-label="Информация о сертификате">
          <h1>${escapeHtml(certificate.title)}</h1>
          <p class="code">№ ${escapeHtml(certificate.code)}</p>
          <p class="status ${displayStatusClass}">${displayStatus}</p>
          ${value}
          ${description}
          ${recipient}
          ${greeting}
          ${signature}
          <div class="dates">
            <p class="date-row"><span>Выдан</span><time datetime="${escapeHtml(certificate.issuedAt)}">${escapeHtml(formatDate(certificate.issuedAt))}</time></p>
            ${giftDate}
            ${expiry}
          </div>
        </section>
        ${activation}
        <footer>${brandName}. Эта страница сохраняет историю вашего подарка. Само открытие сертификата не меняет его статус.</footer>
      </div>
    </details>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatMinorCurrency(amountMinor: number, currency: string): string {
  try {
    const formatter = new Intl.NumberFormat("ru-RU", { style: "currency", currency });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(amountMinor / (10 ** fractionDigits));
  } catch {
    return `${amountMinor} ${currency}`;
  }
}
