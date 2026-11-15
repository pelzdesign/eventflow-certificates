import type { PublicCertificate } from "../domain/certificate.js";
import { DEFAULT_BRAND_PROFILE, type BrandProfile, type GiftStory } from "./brand-profile.js";

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
  const story = brand.giftStory;
  const certificateExpired = Boolean(certificate.expiresAt && new Date(certificate.expiresAt).getTime() <= Date.now());
  const displayStatus = certificateExpired ? "Истёк" : STATUS_LABELS[certificate.status];
  const displayStatusClass = certificateExpired ? "status-muted" : STATUS_CLASSES[certificate.status];

  const value = certificate.value.kind === "service"
    ? escapeHtml(certificate.value.description)
    : escapeHtml(formatMinorCurrency(certificate.value.amountMinor, certificate.value.currency));
  const description = certificate.description ? escapeHtml(certificate.description) : "";
  const recipientName = certificate.recipientName ? escapeHtml(certificate.recipientName) : "";
  const greeting = certificate.greetingText ? escapeHtml(certificate.greetingText) : "";
  const signature = certificate.senderSignature ? escapeHtml(certificate.senderSignature) : "";
  const giftDate = certificate.giftDate
    ? `<p class="date-row"><span>Дата подарка</span><time datetime="${escapeHtml(certificate.giftDate)}">${escapeHtml(formatDate(certificate.giftDate))}</time></p>`
    : "";
  const expiry = certificate.expiresAt
    ? `<p class="date-row"><span>Действует до</span><time datetime="${escapeHtml(certificate.expiresAt)}">${escapeHtml(formatDate(certificate.expiresAt))}</time></p>`
    : "";

  const activationAvailable = certificate.status === "active"
    && !certificateExpired
    && Boolean(certificate.activationUrl && publicToken);
  const activation = activationAvailable
    ? `<section class="activation">
        <p class="activation-note">${certificate.activationRequestedAt
          ? "Вы уже начали активацию подарка. Можно продолжить общение со специалистом."
          : "Чтобы воспользоваться подарком, свяжитесь со специалистом."}</p>
        <form method="post" action="/api/public/certificates/${escapeHtml(publicToken ?? "")}/activate">
          <button type="submit">${certificate.activationRequestedAt
            ? "Написать специалисту"
            : escapeHtml(story?.activationActionLabel ?? "Активировать подарок")}</button>
        </form>
      </section>`
    : certificate.status === "redeemed"
      ? '<p class="used-note">Этот подарок уже подарил свои впечатления. Спасибо, что воспользовались им!</p>'
      : certificateExpired
        ? '<p class="used-note">Срок действия сертификата завершён.</p>'
        : "";

  const legacyContent = `
    <section class="legacy certificate-card" aria-label="Информация о сертификате">
      <p class="eyebrow">${brandName}</p>
      <p class="brand-tagline">${brandTagline}</p>
      <h1>${escapeHtml(certificate.title)}</h1>
      <p class="code">№ ${escapeHtml(certificate.code)}</p>
      <p class="status ${displayStatusClass}">${displayStatus}</p>
      <p class="value">${value}</p>
      ${description ? `<p class="description">${description}</p>` : ""}
      ${recipientName ? `<p class="recipient"><span>Получатель</span>${recipientName}</p>` : ""}
      ${greeting ? `<p class="greeting">${greeting}</p>` : ""}
      ${signature ? `<p class="signature">${signature}</p>` : ""}
      ${renderDates(certificate, giftDate, expiry)}
    </section>
    ${activation}
  `;

  const storyContent = story ? renderGiftStory({
    story,
    brandName,
    brandTagline,
    certificate,
    value,
    description,
    recipientName,
    greeting,
    signature,
    giftDate,
    expiry,
    displayStatus,
    displayStatusClass,
    activation,
  }) : legacyContent;

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="${escapeHtml(brand.theme.page)}">
  <title>${escapeHtml(certificate.title)} — ${brandName}</title>
  <style>
    :root{color-scheme:light;--ink:${escapeHtml(brand.theme.ink)};--muted:${escapeHtml(brand.theme.muted)};--paper:${escapeHtml(brand.theme.surface)};--line:${escapeHtml(brand.theme.line)};--accent:${escapeHtml(brand.theme.accent)};--accent-ink:${escapeHtml(brand.theme.accentInk)};--page:${escapeHtml(brand.theme.page)}}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;min-height:100vh;padding:28px 16px 56px;background:var(--page);color:var(--ink);font-family:Arial,Helvetica,sans-serif}
    main{width:min(100%,680px);margin:0 auto}
    .eyebrow{margin:0 0 14px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.2em;text-align:center;text-transform:uppercase}
    .opening{overflow:hidden;min-height: min(680px, calc(100svh - 56px));display:flex;align-items:center;justify-content:center;padding:48px 26px;background:linear-gradient(155deg,#fffefa 0%,#f1eee5 100%);border:1px solid var(--line);text-align:center}
    .opening-inner{max-width:480px}
    .opening-mark{width:68px;height:68px;margin:0 auto 28px;border:1px solid #b6ad92;border-radius:50%;display:grid;place-items:center;color:#8b876e;font:30px Georgia,serif}
    .opening h1{max-width:440px;margin:0 auto 18px;font:400 clamp(38px,8vw,62px)/1.08 Georgia,serif;letter-spacing:-.035em}
    .opening-copy{max-width:390px;margin:0 auto;color:var(--muted);font:16px/1.8 Georgia,serif}
    .brand-caption{margin:34px 0 0;color:var(--muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase}
    .opening-action{display:inline-block;margin-top:34px;padding:15px 25px;border:1px solid var(--accent);color:var(--ink);font-size:11px;letter-spacing:.13em;text-decoration:none;text-transform:uppercase}
    .story{padding:0 8px}
    .story-section{padding:clamp(58px,10vw,94px) clamp(12px,5vw,42px);border-bottom:1px solid var(--line)}
    .story-section h2{max-width:520px;margin:0 auto 20px;text-align:center;font:400 clamp(29px,6vw,42px)/1.2 Georgia,serif}
    .story-copy{max-width:510px;margin:0 auto;color:var(--muted);font:16px/1.85 Georgia,serif;text-align:center;white-space:pre-wrap}
    .personal-message{max-width:500px;margin:38px auto 0;padding:30px 26px;background:#fffdf8a8;border:1px solid var(--line)}
    .personal-message h3{margin:0 0 18px;text-align:center;font:400 22px/1.3 Georgia,serif}
    .personal-message .greeting{margin:0;text-align:center;white-space:pre-wrap;font:16px/1.8 Georgia,serif}
    .personal-message .signature{margin:18px 0 0;text-align:right;font:italic 16px Georgia,serif}
    .service-panel{max-width:560px;margin:0 auto;padding:clamp(28px,6vw,48px);background:var(--paper);border:1px solid var(--line);box-shadow:0 18px 60px #3028190b}
    .service-panel h2{margin-bottom:12px}
    .service-name{margin:0 0 7px;text-align:center;font:400 19px/1.5 Georgia,serif}
    .service-variant{margin:0 0 14px;color:var(--muted);text-align:center;font:italic 14px Georgia,serif}
    .service-description{max-width:470px;margin:0 auto 28px;color:var(--muted);font-size:13px;line-height:1.75;text-align:center}
    .inclusions{display:grid;gap:0;margin:28px 0 0;padding:0;list-style:none}
    .inclusions li{padding:19px 0;border-top:1px solid var(--line)}
    .inclusions h3{margin:0 0 7px;font:400 19px Georgia,serif}
    .inclusions p{margin:0;color:var(--muted);font-size:13px;line-height:1.7}
    .certificate-meta{max-width:560px;margin:28px auto 0;padding:22px 26px;border:1px solid var(--line);background:#fffdf899}
    .certificate-meta-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .certificate-meta .code{margin:0;color:var(--muted);font-size:11px;letter-spacing:.12em}
    .status{display:inline-block;padding:7px 11px;border-radius:99px;font-size:10px;font-weight:700}
    .status-active{background:#e8efe7;color:#38543d}.status-muted{background:#efede8;color:#69655d}
    .recipient{margin:18px 0 0;text-align:center;font:18px Georgia,serif}
    .recipient span{display:block;margin-bottom:6px;color:var(--muted);font:10px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}
    .dates{margin-top:20px;padding-top:14px;border-top:1px solid var(--line)}
    .date-row{display:flex;justify-content:space-between;gap:16px;margin:8px 0;color:var(--ink);font-size:11px}
    .date-row span{color:var(--muted)}
    .closing{padding-top:clamp(64px,11vw,100px);text-align:center}
    .closing .closing-mark{margin:0 auto 22px;color:var(--accent);font:26px Georgia,serif}
    .closing h2{margin-bottom:16px}
    .activation{max-width:520px;margin:28px auto 0;text-align:center}
    .activation-note,.used-note{color:var(--muted);font-size:12px;line-height:1.7}
    .activation button{margin-top:14px;padding:16px 26px;border:0;border-radius:2px;background:var(--accent);color:var(--accent-ink);font:600 11px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
    .used-note{margin:28px auto 0;padding:16px;border-top:1px solid var(--line)}
    .legacy{padding:clamp(28px,7vw,56px);background:var(--paper);border:1px solid var(--line);box-shadow:0 18px 60px #30281912}
    .legacy h1{margin:0 0 12px;text-align:center;font:400 clamp(28px,6vw,42px)/1.15 Georgia,serif}
    .legacy .brand-tagline,.legacy .description{color:var(--muted);text-align:center;font-size:13px;line-height:1.7}
    .legacy .value{text-align:center;font:22px/1.5 Georgia,serif}
    .legacy .greeting{max-width:420px;margin:24px auto 0;text-align:center;white-space:pre-wrap;font:16px/1.7 Georgia,serif}
    .legacy .signature{margin:20px 0 0;text-align:right;font:italic 16px Georgia,serif}
    footer{margin:28px 0 0;color:var(--muted);font-size:10px;line-height:1.6;text-align:center}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
    @media(max-width:460px){body{padding:12px 10px 36px}.opening{min-height:calc(100svh - 24px)}.certificate-meta{padding:18px}.date-row{font-size:10px}}
  </style>
</head>
<body>
  <main>
    ${storyContent}
    <footer>${brandName}. Эта страница сохраняет историю вашего подарка. Просмотр сертификата не активирует и не погашает его.</footer>
  </main>
</body>
</html>`;
}

interface GiftStoryRenderInput {
  story: GiftStory;
  brandName: string;
  brandTagline: string;
  certificate: PublicCertificate;
  value: string;
  description: string;
  recipientName: string;
  greeting: string;
  signature: string;
  giftDate: string;
  expiry: string;
  displayStatus: string;
  displayStatusClass: string;
  activation: string;
}

function renderGiftStory(input: GiftStoryRenderInput): string {
  const { story, brandName, brandTagline, certificate } = input;
  const inclusions = story.inclusions.map((item) =>
    `<li><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></li>`
  ).join("");
  const personalMessage = input.greeting || input.signature
    ? `<section class="personal-message">
        <h3>${escapeHtml(story.personalMessageTitle)}</h3>
        ${input.greeting ? `<p class="greeting">${input.greeting}</p>` : ""}
        ${input.signature ? `<p class="signature">${input.signature}</p>` : ""}
      </section>`
    : "";
  const recipient = input.recipientName
    ? `<p class="recipient"><span>Этот подарок для</span>${input.recipientName}</p>`
    : "";

  return `
    <section class="opening" aria-labelledby="gift-opening-title">
      <div class="opening-inner">
        <p class="eyebrow">${escapeHtml(story.openingEyebrow)}</p>
        <div class="opening-mark" aria-hidden="true">✧</div>
        <h1 id="gift-opening-title">${escapeHtml(story.openingTitle)}</h1>
        <p class="opening-copy">${escapeHtml(story.openingText)}</p>
        <a class="opening-action" href="#gift-story">${escapeHtml(story.openingAction)}</a>
      </div>
    </section>
    <div class="story" id="gift-story">
      <section class="story-section">
        <p class="eyebrow">${escapeHtml(story.storyEyebrow)}</p>
        <h2>${escapeHtml(story.storyTitle)}</h2>
        <p class="story-copy">${escapeHtml(story.storyText)}</p>
        ${personalMessage}
      </section>
      <section class="story-section">
        <div class="service-panel">
          <p class="eyebrow">${escapeHtml(story.serviceEyebrow)}</p>
          <h2>${escapeHtml(story.serviceTitle)}</h2>
          <p class="service-name">${escapeHtml(certificate.title)}</p>
          <p class="service-description">${escapeHtml(story.serviceText)}</p>
          <p class="eyebrow">В состав подарка входит</p>
          <ul class="inclusions">${inclusions}</ul>
          ${input.description ? `<p class="service-description">${input.description}</p>` : ""}
        </div>
        <div class="certificate-meta">
          <div class="certificate-meta-top">
            <p class="code">СЕРТИФИКАТ № ${escapeHtml(certificate.code)}</p>
            <span class="status ${input.displayStatusClass}">${escapeHtml(input.displayStatus)}</span>
          </div>
          ${recipient}
          ${renderDates(certificate, input.giftDate, input.expiry)}
        </div>
      </section>
      <section class="story-section closing">
        <p class="eyebrow">${escapeHtml(story.closingEyebrow)}</p>
        <div class="closing-mark" aria-hidden="true">✧</div>
        <h2>${escapeHtml(story.closingTitle)}</h2>
        <p class="story-copy">${escapeHtml(story.closingText)}</p>
        ${input.activation}
      </section>
    </div>`;
}

function renderDates(certificate: PublicCertificate, giftDate: string, expiry: string): string {
  return `<div class="dates">
    <p class="date-row"><span>Выдан</span><time datetime="${escapeHtml(certificate.issuedAt)}">${escapeHtml(formatDate(certificate.issuedAt))}</time></p>
    ${giftDate}
    ${expiry}
  </div>`;
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
