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
  options: { previewMode?: boolean } = {},
): string {
  const brandName = escapeHtml(brand.displayName);
  const brandTagline = escapeHtml(brand.tagline);
  const providerName = brand.providerName ? escapeHtml(brand.providerName) : "";
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
    && Boolean(certificate.activationUrl && (publicToken || options.previewMode));
  const activation = activationAvailable
    ? options.previewMode
      ? `<section class="activation" aria-label="Связь со специалистом">
          <p class="activation-note">В настоящем сертификате это действие отправит запрос на активацию подарка. В этом ознакомительном просмотре ссылка открывает контакт специалиста.</p>
          <a class="activation-link" href="${escapeHtml(certificate.activationUrl ?? "")}" target="_blank" rel="noopener">${escapeHtml(story?.activationActionLabel ?? "Активировать подарок")}</a>
        </section>`
      : `<section class="activation" aria-label="Активация подарка">
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
      ? '<p class="used-note" role="status">Этот подарок уже подарил свои впечатления. Спасибо, что воспользовались им!</p>'
      : certificate.status === "cancelled"
        ? '<p class="used-note" role="status">Этот сертификат отменён. Если у вас есть вопросы, обратитесь к отправителю подарка.</p>'
        : certificateExpired || certificate.status === "expired"
          ? '<p class="used-note" role="status">Срок действия сертификата завершён.</p>'
          : certificate.status === "active" && !certificate.activationUrl
            ? '<p class="used-note" role="status">Чтобы воспользоваться подарком, обратитесь к организации, которая его выдала.</p>'
            : "";

  const legacyContent = `
    <details class="opening legacy-opening">
      <summary>
        <span class="eyebrow">Небольшой сюрприз для вас</span>
        <span class="opening-mark" aria-hidden="true">✧</span>
        <span class="opening-title">Для вас приготовили особенный подарок</span>
        <span class="opening-action">Открыть подарок</span>
      </summary>
      <div class="gift-content">
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
      </div>
    </details>
  `;

  const skipLink = story ? '<a class="skip-link" href="#gift-stage-3" data-skip-to-story>Перейти к истории подарка</a>' : "";
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
    .skip-link{position:absolute;z-index:20;top:12px;left:12px;padding:12px 16px;transform:translateY(-160%);border-radius:99px;background:var(--ink);color:#fff;text-decoration:none}
    .skip-link:focus{transform:translateY(0)}
    a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:4px}
    body{margin:0;min-height:100vh;padding:0 18px 64px;background:radial-gradient(ellipse at 50% 0%,#fffdf7 0%,var(--page) 62%);color:var(--ink);font-family:Arial,Helvetica,sans-serif}
    main{width:min(100%,920px);margin:0 auto}
    .hero-art{width:min(100%,390px);height:190px;margin:0 auto 12px;display:grid;place-items:center}
    .hero-art svg{width:100%;height:100%;overflow:visible}
    .hero-art .orbit{transform-origin:210px 130px;animation:orbit 36s linear infinite}
    .hero-art .house-line{fill:none;stroke:#78856e;stroke-width:1.35}
    .hero-art .fine-line{fill:none;stroke:#b7ad91;stroke-width:1}
    @keyframes orbit{to{transform:rotate(360deg)}}
    .chapter-index{margin:0 0 22px;color:var(--accent);font-size:10px;font-weight:700;letter-spacing:.22em;text-align:center}
    .story-section{position:relative}
    .story-section:first-child{background:linear-gradient(180deg,#fffdf8a8,transparent);border-radius:28px 28px 0 0}
    .story-section:nth-child(2){background:linear-gradient(180deg,#e9e7dc80,transparent)}
    .story-section.closing{margin-top:20px;padding:clamp(56px,9vw,92px) clamp(18px,6vw,58px);background:linear-gradient(145deg,#58694f,#344637);border-radius:26px;color:#fffdf7}
    .closing .eyebrow,.closing .story-copy{color:#e7e8dd}
    .opening{position:relative;min-height:min(820px,calc(100svh - 28px));margin:14px auto 26px;border-radius:28px;box-shadow:0 28px 90px #40392312;background:radial-gradient(ellipse at 50% 34%,#fffefa 0%,#f5f1e7 54%,#e9e6da 100%)}
    .opening:before,.opening:after{content:"";position:absolute;pointer-events:none;border:1px solid #bdb59c55;border-radius:50%}
    .opening:before{inset:18px}.opening:after{inset:28px;border-style:dashed;opacity:.45}
    .opening-inner{position:relative;z-index:1;max-width:560px}
    .opening-mark{display:none}
    .opening h1{max-width:540px}
    .opening-copy{max-width:430px}
    .brand-caption{letter-spacing:.18em}
    .opening-action{border-radius:99px;padding:16px 30px;transition:background .25s,color .25s,transform .25s}
    .opening-action:hover{background:var(--accent);color:var(--accent-ink);transform:translateY(-2px)}
    .story-section h2{max-width:620px}
    .story-copy{max-width:600px}
    .personal-message{position:relative;max-width:560px;margin:48px auto 0;padding:38px 34px;background:linear-gradient(145deg,#fffefa,#f6f1e6);border:1px solid #d9d1bf;border-radius:4px 18px 18px 18px;box-shadow:0 18px 44px #4039230d}
    .personal-message:before{content:"";position:absolute;top:0;left:34px;width:48px;height:3px;background:var(--accent)}
    .service-panel{max-width:760px;border-radius:24px;padding:clamp(30px,6vw,64px);background:linear-gradient(145deg,#fffefa,#f7f4ec);box-shadow:0 28px 70px #30281912}
    .inclusions{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:36px}
    .inclusions li{padding:24px 18px;border:1px solid var(--line);border-radius:14px;background:#fffefa}
    .inclusions li:before{content:"✧";display:block;margin-bottom:16px;color:var(--accent);font:22px Georgia,serif}
    .inclusions h3{font-size:17px;line-height:1.35}
    .inclusions p{font-size:12px}
    .certificate-meta{max-width:760px;border-radius:18px;padding:26px 30px;background:#fffdf8d9}
    .closing .closing-mark{color:#e2d7b8}
    .closing .activation button,.closing .activation-link{background:#f5f0e4;color:#3d4d3b;border-radius:99px;padding:18px 32px;transition:transform .2s,box-shadow .2s}
    .closing .activation button:hover,.closing .activation-link:hover{transform:translateY(-2px);box-shadow:0 12px 28px #17251c44}
    footer{padding:24px 10px 0}
    .eyebrow{margin:0 0 14px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.2em;text-align:center;text-transform:uppercase}
    .opening{overflow:hidden;min-height: min(680px, calc(100svh - 56px));display:flex;align-items:center;justify-content:center;padding:48px 26px;background:linear-gradient(155deg,#fffefa 0%,#f1eee5 100%);border:1px solid var(--line);text-align:center}
    .opening-inner{max-width:480px}
    .legacy-opening>summary{list-style:none;cursor:pointer;min-height:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:52px 28px;text-align:center}
    .legacy-opening>summary::-webkit-details-marker{display:none}
    .legacy-opening .opening-title{max-width:380px;font:400 clamp(30px,7vw,44px)/1.2 Georgia,serif}
    .legacy-opening[open]>summary{display:none}
    .legacy-opening .gift-content{animation:reveal .6s ease both}
    @keyframes reveal{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
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
    .activation button,.activation-link{display:inline-block;margin-top:14px;padding:16px 26px;border:0;border-radius:2px;background:var(--accent);color:var(--accent-ink);font:600 11px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;cursor:pointer}
    .used-note{margin:28px auto 0;padding:16px;border-top:1px solid var(--line)}
    /* Final Vastu story art direction overrides the neutral certificate defaults. */
    .opening{min-height:min(820px,calc(100svh - 28px));margin:14px auto 26px;border-radius:28px;box-shadow:0 28px 90px #40392312;background:radial-gradient(ellipse at 50% 34%,#fffefa 0%,#f5f1e7 54%,#e9e6da 100%)}
    .opening:before,.opening:after{content:"";position:absolute;pointer-events:none;border:1px solid #bdb59c55;border-radius:50%}
    .opening:before{inset:18px}.opening:after{inset:28px;border-style:dashed;opacity:.45}
    .opening-inner{position:relative;z-index:1;max-width:560px}
    .hero-art{width:min(100%,390px);height:190px;margin:0 auto 12px;display:grid;place-items:center}
    .hero-art svg{width:100%;height:100%;overflow:visible}
    .hero-art .orbit{transform-origin:210px 130px;animation:orbit 36s linear infinite}
    .hero-art .house-line{fill:none;stroke:#78856e;stroke-width:1.35}
    .hero-art .fine-line{fill:none;stroke:#b7ad91;stroke-width:1}
    @keyframes orbit{to{transform:rotate(360deg)}}
    .opening-mark{display:none}
    .opening h1{max-width:540px}
    .opening-copy{max-width:430px}
    .opening-action{border-radius:99px;padding:16px 30px;transition:background .25s,color .25s,transform .25s}
    .opening-action:hover{background:var(--accent);color:var(--accent-ink);transform:translateY(-2px)}
    .story-section:first-child{background:linear-gradient(180deg,#fffdf8a8,transparent);border-radius:28px 28px 0 0}
    .story-section:nth-child(2){background:linear-gradient(180deg,#e9e7dc80,transparent)}
    .story-section h2{max-width:620px}
    .story-copy{max-width:600px}
    .chapter-index{margin:0 0 22px;color:var(--accent);font-size:10px;font-weight:700;letter-spacing:.22em;text-align:center}
    .personal-message{position:relative;max-width:560px;margin:48px auto 0;padding:38px 34px;background:linear-gradient(145deg,#fffefa,#f6f1e6);border:1px solid #d9d1bf;border-radius:4px 18px 18px 18px;box-shadow:0 18px 44px #4039230d}
    .personal-message:before{content:"";position:absolute;top:0;left:34px;width:48px;height:3px;background:var(--accent)}
    .service-panel{max-width:760px;border-radius:24px;padding:clamp(30px,6vw,64px);background:linear-gradient(145deg,#fffefa,#f7f4ec);box-shadow:0 28px 70px #30281912}
    .inclusions{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:36px}
    .inclusions li{padding:24px 18px;border:1px solid var(--line);border-radius:14px;background:#fffefa}
    .inclusions li:before{content:"✧";display:block;margin-bottom:16px;color:var(--accent);font:22px Georgia,serif}
    .inclusions h3{font-size:17px;line-height:1.35}
    .inclusions p{font-size:12px}
    .certificate-meta{max-width:760px;border-radius:18px;padding:26px 30px;background:#fffdf8d9}
    .story-section.closing{margin-top:20px;padding:clamp(56px,9vw,92px) clamp(18px,6vw,58px);background:linear-gradient(145deg,#58694f,#344637);border-radius:26px;color:#fffdf7}
    .closing .eyebrow,.closing .story-copy{color:#e7e8dd}
    .closing .closing-mark{color:#e2d7b8}
    .closing .activation button{background:#f5f0e4;color:#3d4d3b;border-radius:99px;padding:18px 32px;transition:transform .2s,box-shadow .2s}
    .closing .activation button:hover{transform:translateY(-2px);box-shadow:0 12px 28px #17251c44}
    .legacy{padding:clamp(28px,7vw,56px);background:var(--paper);border:1px solid var(--line);box-shadow:0 18px 60px #30281912}
    .legacy h1{margin:0 0 12px;text-align:center;font:400 clamp(28px,6vw,42px)/1.15 Georgia,serif}
    .legacy .brand-tagline,.legacy .description{color:var(--muted);text-align:center;font-size:13px;line-height:1.7}
    .legacy .value{text-align:center;font:22px/1.5 Georgia,serif}
    .legacy .greeting{max-width:420px;margin:24px auto 0;text-align:center;white-space:pre-wrap;font:16px/1.7 Georgia,serif}
    .legacy .signature{margin:20px 0 0;text-align:right;font:italic 16px Georgia,serif}
    footer{margin:28px 0 0;color:var(--muted);font-size:10px;line-height:1.6;text-align:center}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero-art .orbit{animation:none}.opening-action,.closing .activation button,.closing .activation-link{transition:none}}
    @media print{body{padding:0;background:#fff}.opening,.story-section.closing,.service-panel,.certificate-meta{box-shadow:none;break-inside:avoid}.opening{min-height:auto;padding:48px 20px}.hero-art .orbit{animation:none}a{color:inherit;text-decoration:none}.activation button{display:none}footer{padding-bottom:0}}
    @media(max-width:640px){body{padding:0 10px 42px}.opening{min-height:calc(100svh - 20px);margin:10px auto 18px;padding:48px 18px}.hero-art{height:150px}.story-section{padding:58px 16px}.inclusions{grid-template-columns:1fr}.inclusions li{display:grid;grid-template-columns:32px 1fr;column-gap:12px}.inclusions li:before{grid-row:span 2;margin:0}.certificate-meta{padding:20px}.closing.story-section{padding:58px 20px;border-radius:18px}.date-row{font-size:10px}}
    @media(prefers-reduced-motion:reduce){.hero-art .orbit{animation:none}.opening-action,.closing .activation button,.closing .activation-link{transition:none}}

    /* Five-stage gift reveal: quiet progress, an unfolding letter, then a distinct activation finale. */
    body{padding-bottom:92px}
    .gift-experience{max-width:820px;margin:0 auto}
    .gift-progress{position:fixed;left:50%;bottom:14px;z-index:100;transform:translateX(-50%);padding:9px 14px;border:1px solid #d9d2c2;border-radius:99px;background:#fffdf0e8;box-shadow:0 8px 28px #30281918;backdrop-filter:blur(12px)}
    .gift-progress ol{display:flex;align-items:center;justify-content:center;gap:11px;margin:0;padding:0;list-style:none}
    .gift-progress li{display:grid;place-items:center;width:8px;height:8px}
    .gift-dot{display:block;width:6px;height:6px;border-radius:50%;background:#c9c4b7;transition:width .25s ease,height .25s ease,background .25s ease,box-shadow .25s ease}
    .gift-progress li.is-current .gift-dot{width:8px;height:8px;background:var(--accent);box-shadow:0 0 0 3px #78856e26,0 0 12px #78856eaa}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .gift-stage{min-height:min(760px,calc(100svh - 34px));display:flex;align-items:center;justify-content:center;margin:14px auto 28px;padding:clamp(30px,6vw,64px) clamp(16px,5vw,44px);border:1px solid var(--line);border-radius:28px;background:radial-gradient(ellipse at 50% 0%,#fffefa 0%,#f4f1e8 72%);box-shadow:0 24px 70px #4039230d}
    .gift-stage[hidden]{display:none!important}
    .gift-experience.is-enhanced [data-gift-stage]:not(.is-active){display:none}
    .gift-stage.is-active{animation:stage-arrive .42s ease both}
    @keyframes stage-arrive{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .stage-inner{width:min(100%,650px);margin:0 auto;text-align:center}
    .gift-stage h2{max-width:620px;margin:0 auto 20px;font:400 clamp(30px,6vw,46px)/1.18 Georgia,serif;letter-spacing:-.025em}
    .stage-intro{max-width:430px;margin:0 auto;color:var(--muted);font:15px/1.8 Georgia,serif}
    .stage-actions,.stage-navigation{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:30px}
    .primary-action,.opening-action{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:15px 28px;border:0;border-radius:99px;background:var(--accent);color:var(--accent-ink);font:600 11px Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;text-decoration:none;cursor:pointer}
    .text-action{padding:12px 16px;border:0;background:transparent;color:var(--muted);font:12px Arial,sans-serif;text-decoration:underline;text-underline-offset:4px;cursor:pointer}
    .primary-action:hover,.opening-action:hover{filter:brightness(.96);transform:translateY(-1px)}
    .envelope-scene{height:190px;display:grid;place-items:center;margin:34px auto 18px;perspective:900px}
    .envelope{position:relative;width:min(280px,78vw);height:160px;border:1px solid #c9bea5;border-radius:5px;background:#e9e1cf;box-shadow:0 18px 38px #40392318;transition:transform .85s cubic-bezier(.2,.7,.2,1),opacity .65s ease}
    .envelope-pocket{position:absolute;inset:0;background:linear-gradient(145deg,#e7dfcd,#d9ceb7);clip-path:polygon(0 0,50% 62%,100% 0,100% 100%,0 100%);z-index:3}
    .envelope-flap{position:absolute;inset:0;background:#f3ecdc;clip-path:polygon(0 0,100% 0,50% 66%);transform-origin:50% 0;transition:transform .8s ease;z-index:4;backface-visibility:hidden}
    .envelope-letter{position:absolute;left:9%;right:9%;top:12px;height:128px;border:1px solid #d8cfbd;background:#fffdf7;transition:transform .85s ease;z-index:2}
    .envelope.is-open .envelope-flap{transform:rotateX(180deg);z-index:1}
    .envelope.is-open .envelope-letter{transform:translateY(-78px);z-index:5}
    .envelope-stage.is-letter-opening .envelope{transform:translateY(230px);opacity:0}
    .letter-sheet{position:fixed;left:50%;top:50%;z-index:50;width:min(320px,82vw);height:190px;overflow:auto;padding:28px 24px;border:1px solid #d8cfbd;border-radius:4px;background:#fffdf7;box-shadow:0 22px 70px #30281930;opacity:0;visibility:hidden;transform:translate(-50%,-12%);transition:left .72s cubic-bezier(.2,.7,.2,1),top .72s cubic-bezier(.2,.7,.2,1),width .72s cubic-bezier(.2,.7,.2,1),height .72s cubic-bezier(.2,.7,.2,1),border-radius .72s ease,opacity .35s ease,transform .72s ease}
    .letter-sheet.is-expanded{left:0;top:0;width:100vw;height:100dvh;max-height:100dvh;border:0;border-radius:0;opacity:1;visibility:visible;transform:none}
    .letter-sheet-content{width:min(100%,620px);min-height:100%;margin:0 auto;padding:clamp(64px,12vh,110px) 8px 110px;display:flex;flex-direction:column;justify-content:center;opacity:0;transition:opacity .55s ease}
    .letter-sheet.is-visible .letter-sheet-content{opacity:1}
    .letter-sheet.is-leaving{opacity:0;transform:scale(1.035);}
    .letter-sheet .eyebrow{margin-bottom:26px}
    .letter-sheet .greeting{margin:0;color:var(--ink);font:clamp(17px,3vw,20px)/1.9 Georgia,serif;text-align:center}
    .letter-sheet .signature{margin:24px 0 0;text-align:right;color:var(--muted);font:italic 16px Georgia,serif}
    .letter-sheet .stage-actions{margin-top:38px}
    .letter-sheet [data-letter-next][hidden]{display:none}
    .reveal-line{display:block;opacity:0;transform:translateY(8px);animation:line-arrive .55s ease forwards;animation-delay:calc(var(--reveal-delay,0ms) + .2s)}
    @keyframes line-arrive{to{opacity:1;transform:translateY(0)}}
    .story-art{margin:34px auto 12px;color:var(--accent);font:54px Georgia,serif}
    .story-stage .story-copy{font-size:17px}
    .story-stage.is-active{animation:paper-arrive .68s cubic-bezier(.2,.7,.2,1) both}
    @keyframes paper-arrive{from{opacity:.35;transform:scale(.94);border-radius:38px}to{opacity:1;transform:scale(1);border-radius:28px}}
    .story-subtitle{margin:0 auto 22px;color:var(--muted);font:italic 16px/1.6 Georgia,serif}
    .contents-stage{display:block;min-height:0;align-items:stretch;justify-content:flex-start;padding-top:clamp(40px,8vh,80px);padding-bottom:110px}
    .contents-stage .stage-inner{padding-bottom:24px}
    .contents-stage .service-panel{margin:0 auto}
    .contents-stage .certificate-meta{margin:22px auto 0}
    .contents-stage .stage-navigation{margin-top:36px}
    .closing-stage{background:linear-gradient(145deg,#58694f,#344637);color:#fffdf7;border-color:#58694f}
    .closing-stage .closing{padding:0;background:transparent}
    .closing-stage .eyebrow,.closing-stage .story-copy{color:#e7e8dd}
    .closing-stage .closing-mark{color:#e2d7b8}
    .closing-stage .activation button,.closing-stage .activation-link{background:#f5f0e4;color:#3d4d3b;border-radius:99px;padding:18px 32px}
    .stage-footnote{max-width:470px;margin:30px auto 0;color:#e7e8dd;font-size:11px;line-height:1.7}
    .closing-stage .text-action{color:#f5f0e4}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.gift-stage.is-active{animation:none}.envelope,.envelope-flap,.envelope-letter,.letter-sheet,.letter-sheet-content,.reveal-line,.gift-dot{transition:none;animation:none}.reveal-line{opacity:1;transform:none}.primary-action,.opening-action{transition:none}}
    @media(max-width:640px){.gift-stage{min-height:calc(100svh - 30px);margin:8px auto 18px;padding:38px 18px;border-radius:20px}.envelope-scene{height:170px}.letter-sheet-content{padding:58px 22px 104px}.contents-stage{min-height:0;padding:34px 18px 110px}.gift-progress{bottom:10px}}

  </style>
</head>
<body>
  ${skipLink}
  <main>
    ${storyContent}
    <footer><strong>${brandName}</strong>${providerName ? ` · Услугу оказывает ${providerName}.` : "."} Эта страница работает на платформе EventFlow Certificates и сохраняет историю вашего подарка. ${story ? "Просмотр сертификата не активирует и не погашает его." : "Само открытие сертификата не меняет его статус."}</footer>
  </main>

  <script>
    (() => {
      const experience = document.querySelector("[data-gift-experience]");
      if (!experience) return;
      const stages = Array.from(experience.querySelectorAll("[data-gift-stage]"));
      const progress = Array.from(experience.querySelectorAll("[data-progress-step]"));
      const progressLabel = experience.querySelector(".gift-progress-label");
      let current = 0;
      experience.classList.add("is-enhanced");

      function showStage(index, moveFocus = true) {
        current = Math.max(0, Math.min(stages.length - 1, index));
        stages.forEach((stage, i) => {
          const active = i === current;
          stage.classList.toggle("is-active", active);
          stage.hidden = !active;
          stage.setAttribute("aria-hidden", active ? "false" : "true");
        });
        progress.forEach((item, i) => {
          item.classList.toggle("is-current", i === current);
          if (i === current) item.setAttribute("aria-current", "step");
          else item.removeAttribute("aria-current");
        });
        if (progressLabel) progressLabel.textContent = "Экран " + (current + 1) + " из " + stages.length;
        if (moveFocus) {
          const heading = stages[current].querySelector("h1,h2");
          if (heading) {
            if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
          } else stages[current].focus({ preventScroll: true });
        }
        window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }

      function revealLetter(animate) {
        const stage = experience.querySelector('[data-gift-stage="1"]');
        const envelope = experience.querySelector("[data-envelope]");
        const letter = experience.querySelector("#letter-copy");
        const openButton = experience.querySelector("[data-open-envelope]");
        const skipButton = experience.querySelector("[data-skip-envelope]");
        const nextButton = experience.querySelector("[data-letter-next]");
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (stage) stage.classList.add("is-letter-opening");
        if (envelope) envelope.classList.add("is-open");
        if (openButton) openButton.hidden = true;
        if (skipButton) skipButton.hidden = true;
        if (!letter) return;
        letter.setAttribute("aria-hidden", "false");
        const expandAndReveal = () => {
          letter.classList.add("is-expanded");
          requestAnimationFrame(() => {
            letter.classList.add("is-visible");
            const lineCount = letter.querySelectorAll(".reveal-line").length;
            const delay = animate && !reducedMotion ? 850 + lineCount * 130 + 700 : 0;
            window.setTimeout(() => { if (nextButton) nextButton.hidden = false; }, delay);
          });
        };
        if (!animate || reducedMotion) {
          expandAndReveal();
        } else {
          window.setTimeout(expandAndReveal, 420);
        }
      }

      experience.addEventListener("click", (event) => {
        const target = event.target.closest("button,a");
        if (!target) return;
        if (target.matches("[data-next-stage]")) {
          event.preventDefault();
          if (current === 1) {
            const letter = experience.querySelector("#letter-copy");
            if (!letter?.classList.contains("is-visible")) return;
            letter.classList.add("is-leaving");
            const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380;
            window.setTimeout(() => showStage(2), delay);
            return;
          }
          showStage(current + 1);
        } else if (target.matches("[data-prev-stage]")) {
          event.preventDefault();
          showStage(current - 1);
        } else if (target.matches("[data-open-envelope]")) {
          event.preventDefault();
          revealLetter(true);
        } else if (target.matches("[data-skip-envelope]")) {
          event.preventDefault();
          revealLetter(false);
        } else if (target.matches("[data-skip-to-story]")) {
          event.preventDefault();
          showStage(2);
        }
      });
      const skipLink = document.querySelector("[data-skip-to-story]");
      if (skipLink) skipLink.addEventListener("click", (event) => {
        event.preventDefault();
        showStage(2);
      });
      showStage(0, false);
    })();
  </script>

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

function renderRevealLines(value: string, alreadyEscaped = false): string {
  return value.split(/\r?\n/).map((line, index) =>
    `<span class="reveal-line" style="--reveal-delay: ${index * 130}ms">${alreadyEscaped ? line : escapeHtml(line) || "&nbsp;"}</span>`
  ).join("");
}

function renderGiftStory(input: GiftStoryRenderInput): string {
  const { story, brandName, brandTagline, certificate } = input;
  const inclusions = story.inclusions.map((item) =>
    `<li><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></li>`
  ).join("");
  const greetingText = input.greeting || "Для вас приготовили особенный подарок.";
  const personalMessage = `<div class="letter-sheet" id="letter-copy" aria-hidden="true">
      <div class="letter-sheet-content">
        <p class="eyebrow">${escapeHtml(story.personalMessageTitle)}</p>
        <p class="greeting">${renderRevealLines(greetingText, true)}</p>
        ${input.signature ? `<p class="signature reveal-line" style="--reveal-delay: ${greetingText.split(/\r?\n/).length * 130}ms">${input.signature}</p>` : ""}
        <div class="stage-actions"><button class="primary-action" type="button" data-next-stage data-letter-next hidden>Продолжить</button></div>
      </div>
    </div>`;
  const recipient = input.recipientName
    ? `<p class="recipient"><span>Этот подарок для</span>${input.recipientName}</p>`
    : "";
  const coverTitle = input.recipientName === "Илья и Анна"
    ? "Для Ильи и Анны. Один особенный подарок для вашего дома"
    : "Один особенный подарок для вас";

  return `
    <div class="gift-experience" data-gift-experience role="region" aria-label="История подарка">
      <nav class="gift-progress" aria-label="Прогресс раскрытия подарка">
        <ol>
          <li class="is-current" data-progress-step="0" aria-current="step"><span class="gift-dot"></span></li>
          <li data-progress-step="1"><span class="gift-dot"></span></li>
          <li data-progress-step="2"><span class="gift-dot"></span></li>
          <li data-progress-step="3"><span class="gift-dot"></span></li>
          <li data-progress-step="4"><span class="gift-dot"></span></li>
        </ol>
        <span class="sr-only gift-progress-label" aria-live="polite">Экран 1 из 5</span>
      </nav>

      <section class="opening gift-stage is-active" data-gift-stage="0" id="gift-stage-1" aria-labelledby="gift-opening-title" tabindex="-1">
        <div class="opening-inner">
          <p class="eyebrow">${escapeHtml(story.openingEyebrow)}</p>
          <div class="hero-art" aria-hidden="true">
            <svg viewBox="0 0 420 260" role="presentation">
              <g class="orbit">
                <circle cx="210" cy="130" r="112" class="fine-line" stroke-dasharray="2 8"/>
                <path d="M210 8v18M210 234v18M88 130h18M314 130h18" class="fine-line"/>
                <path d="M210 22l5 13h-10zM210 238l5-13h-10zM102 130l13-5v10zM318 130l-13-5v10z" fill="#9b906f"/>
              </g>
              <circle cx="210" cy="130" r="84" fill="#f7f3e9" stroke="#c8bea4"/>
              <path d="M150 78h120v104H150z" class="house-line"/>
              <path d="M210 78v104M150 130h120M180 78v52M240 130v52M180 130v52M240 78v52" class="fine-line"/>
              <path d="M150 78l60-34 60 34" class="house-line"/>
              <path d="M194 182v-31h32v31M150 105h30v25h-30M240 105h30v25h-30" class="house-line"/>
              <circle cx="210" cy="130" r="12" fill="#78856e"/>
              <circle cx="210" cy="130" r="4" fill="#f7f3e9"/>
              <path d="M210 115v-15M210 160v-15M195 130h-15M240 130h-15" class="fine-line"/>
            </svg>
          </div>
          <h1 id="gift-opening-title">${escapeHtml(coverTitle)}</h1>
          <p class="opening-copy">${escapeHtml(story.openingText)}</p>
          <p class="brand-caption">${brandName} · ${brandTagline}</p>
          <button class="opening-action" type="button" data-next-stage>Открыть подарок</button>
        </div>
      </section>

      <section class="gift-stage envelope-stage" data-gift-stage="1" id="gift-stage-2" aria-labelledby="envelope-title" tabindex="-1">
        <div class="stage-inner">
          <p class="eyebrow">Личное послание</p>
          <h2 id="envelope-title">Для вас есть послание</h2>
          <p class="stage-intro">Прежде чем узнать, что скрывает подарок, откройте письмо от того, кто его подготовил.</p>
          <div class="envelope-scene">
            <div class="envelope" data-envelope aria-hidden="true">
              <div class="envelope-letter"></div>
              <div class="envelope-pocket"></div>
              <div class="envelope-flap"></div>
            </div>
          </div>
          ${personalMessage}
          <div class="stage-actions envelope-actions">
            <button class="primary-action" type="button" data-open-envelope>Открыть конверт</button>
            <button class="text-action" type="button" data-skip-envelope>Показать письмо без анимации</button>
            
          </div>
          <div class="stage-navigation"><button type="button" class="text-action" data-prev-stage>Назад</button></div>
        </div>
      </section>

      <section class="gift-stage story-stage" data-gift-stage="2" id="gift-stage-3" aria-labelledby="story-title" tabindex="-1">
        <div class="stage-inner">
          
          <p class="eyebrow">${escapeHtml(story.storyEyebrow)}</p>
          <h2 id="story-title">${renderRevealLines(story.openingTitle)}</h2>
          <p class="story-subtitle">${renderRevealLines(story.storyTitle)}</p>
          <p class="story-copy">${renderRevealLines(story.storyText)}</p>
          <div class="story-art" aria-hidden="true">✧</div>
          <p class="brand-caption">${brandName} · ${brandTagline}</p>
          <div class="stage-navigation">
            <button type="button" class="text-action" data-prev-stage>Назад</button>
            <button type="button" class="primary-action" data-next-stage>Узнать, что внутри</button>
          </div>
        </div>
      </section>

      <section class="gift-stage contents-stage" data-gift-stage="3" id="gift-stage-4" aria-labelledby="contents-title" tabindex="-1">
        <div class="stage-inner">
          
          <div class="service-panel">
            <p class="eyebrow">${escapeHtml(story.serviceEyebrow)}</p>
            <h2 id="contents-title">${escapeHtml(story.serviceTitle)}</h2>
            <p class="service-name">${escapeHtml(certificate.title)}</p>
            <p class="service-variant">${input.value}</p>
            <p class="service-description">${escapeHtml(story.serviceText)}</p>
            <p class="eyebrow">В состав подарка входит</p>
            <ul class="inclusions">${inclusions}</ul>
          </div>
          <div class="certificate-meta">
            <div class="certificate-meta-top">
              <p class="code">СЕРТИФИКАТ № ${escapeHtml(certificate.code)}</p>
              <span class="status ${input.displayStatusClass}">${escapeHtml(input.displayStatus)}</span>
            </div>
            ${recipient}
            ${renderDates(certificate, input.giftDate, input.expiry)}
          </div>
          <div class="stage-navigation">
            <button type="button" class="text-action" data-prev-stage>Назад</button>
            <button type="button" class="primary-action" data-next-stage>Перейти к активации</button>
          </div>
        </div>
      </section>

      <section class="gift-stage closing-stage" data-gift-stage="4" id="gift-stage-5" aria-labelledby="activation-title" tabindex="-1">
        <div class="stage-inner closing">
          
          <p class="eyebrow">${escapeHtml(story.closingEyebrow)}</p>
          <div class="closing-mark" aria-hidden="true">✧</div>
          <h2 id="activation-title">${escapeHtml(story.closingTitle)}</h2>
          <p class="story-copy">${escapeHtml(story.closingText)}</p>
          ${input.activation}
          <p class="stage-footnote">Открытие истории подарка не активирует сертификат. Активация — отдельный шаг; сама услуга будет оказана специалистом после согласования с вами.</p>
          <div class="stage-navigation">
            <button type="button" class="text-action" data-prev-stage>Назад</button>
          </div>
        </div>
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
