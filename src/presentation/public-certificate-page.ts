import type { PublicCertificate } from "../domain/certificate.js";

const STATUS_LABELS: Record<PublicCertificate["status"], string> = {
  active: "Действителен",
  redeemed: "Использован",
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
export function renderPublicCertificatePage(certificate: PublicCertificate): string {
  const value = certificate.value.kind === "service"
    ? `<p class="value">${escapeHtml(certificate.value.description)}</p>`
    : `<p class="value">${escapeHtml(formatMinorCurrency(certificate.value.amountMinor, certificate.value.currency))}</p>`;

  const description = certificate.description
    ? `<p class="description">${escapeHtml(certificate.description)}</p>`
    : "";
  const recipient = certificate.recipientName
    ? `<p class="recipient"><span>Получатель</span>${escapeHtml(certificate.recipientName)}</p>`
    : "";
  const expiry = certificate.expiresAt
    ? `<p class="date-row"><span>Действует до</span><time datetime="${escapeHtml(certificate.expiresAt)}">${escapeHtml(formatDate(certificate.expiresAt))}</time></p>`
    : "";

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#f5f2ec">
  <title>${escapeHtml(certificate.title)} — сертификат ${escapeHtml(certificate.code)}</title>
  <style>
    :root{color-scheme:light;--ink:#24231f;--muted:#77736b;--paper:#fffefa;--line:#e9e4da;--accent:#526b57}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;padding:32px 18px;display:grid;place-items:center;background:#f5f2ec;color:var(--ink);font-family:Arial,Helvetica,sans-serif}
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
    .recipient span{display:block;margin-bottom:6px;color:var(--muted);font-size:11px;letter-spacing:.1em;text-transform:uppercase}
    .dates{margin-top:32px;padding-top:20px;border-top:1px solid var(--line)}
    .date-row{display:flex;justify-content:space-between;gap:16px;margin:8px 0;font-size:12px}
    .date-row span{color:var(--muted)}
    footer{margin:20px 0 0;text-align:center;color:var(--muted);font-size:11px;line-height:1.5}
    @media(max-width:420px){body{padding:20px 12px}.date-row{font-size:11px}}
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Подарочный сертификат</p>
    <section class="card" aria-label="Информация о сертификате">
      <h1>${escapeHtml(certificate.title)}</h1>
      <p class="code">№ ${escapeHtml(certificate.code)}</p>
      <p class="status ${STATUS_CLASSES[certificate.status]}">${STATUS_LABELS[certificate.status]}</p>
      ${value}
      ${description}
      ${recipient}
      <div class="dates">
        <p class="date-row"><span>Выдан</span><time datetime="${escapeHtml(certificate.issuedAt)}">${escapeHtml(formatDate(certificate.issuedAt))}</time></p>
        ${expiry}
      </div>
    </section>
    <footer>Страница предназначена для просмотра информации о сертификате.<br>Открытие страницы не изменяет его статус.</footer>
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
