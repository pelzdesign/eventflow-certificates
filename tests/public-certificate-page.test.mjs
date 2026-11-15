import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPublicCertificatePage } from '../dist/presentation/public-certificate-page.js';

const baseCertificate = {
  code: 'GIFT-001',
  kind: 'service',
  value: { kind: 'service', description: 'Одна консультация' },
  title: 'Подарочный сертификат',
  description: 'Подробности сертификата',
  recipientName: 'Анна',
  status: 'active',
  issuedAt: '2026-11-13T12:00:00.000Z',
  expiresAt: '2027-11-13T12:00:00.000Z',
};

test('public page renders certificate details and read-only status', () => {
  const html = renderPublicCertificatePage(baseCertificate);
  assert.match(html, /Подарочный сертификат/);
  assert.match(html, /GIFT-001/);
  assert.match(html, /Одна консультация/);
  assert.match(html, /Действителен/);
  assert.match(html, /Анна/);
  assert.match(html, /Само открытие сертификата не меняет его статус/);
  assert.match(html, /noindex,nofollow/);
});

test('public page escapes all certificate-supplied HTML', () => {
  const html = renderPublicCertificatePage({
    ...baseCertificate,
    title: '<script>alert("title")</script>',
    code: 'X"><img src=x onerror=alert(1)>',
    value: { kind: 'service', description: '<svg onload=alert(1)>' },
    description: 'A & B',
    recipientName: "'><script>alert(2)</script>",
  });
  assert.ok(html.includes('&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;svg onload=alert(1)&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.doesNotMatch(html, /<script>|<svg onload|<img src=x/);
});

test('monetary certificate formats minor units using currency fraction digits', () => {
  const html = renderPublicCertificatePage({
    ...baseCertificate,
    kind: 'monetary',
    value: { kind: 'monetary', amountMinor: 125050, currency: 'RUB' },
  });
  assert.match(html, /1\s?250,50\s?₽/);
});

test('unknown currency does not break public page rendering', () => {
  const html = renderPublicCertificatePage({
    ...baseCertificate,
    kind: 'monetary',
    value: { kind: 'monetary', amountMinor: 500, currency: 'XXX_INVALID' },
  });
  assert.match(html, /500 XXX_INVALID/);
});

test('public page renders gift date, greeting and sender signature safely', () => {
  const html = renderPublicCertificatePage({
    ...baseCertificate,
    giftDate: '2026-12-31',
    greetingText: 'Пусть в вашем доме будет тепло и гармония.',
    senderSignature: 'Илья и Анна',
  });
  assert.match(html, /Дата подарка/);
  assert.match(html, /Пусть в вашем доме будет тепло и гармония\./);
  assert.match(html, /Илья и Анна/);
});

test('public page escapes gift personalization fields', () => {
  const html = renderPublicCertificatePage({
    ...baseCertificate,
    greetingText: '<img src=x onerror=alert(1)>',
    senderSignature: '<script>alert(1)</script>',
  });
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.doesNotMatch(html, /<img src=x|<script>/);
});


test('public certificate opens through a gift reveal and offers a deliberate activation action', () => {
  const html = renderPublicCertificatePage({
    ...baseCertificate,
    activationUrl: 'https://vk.me/example_specialist',
  }, 'a'.repeat(64));
  assert.match(html, /Открыть подарок/);
  assert.match(html, /Для вас приготовили особенный подарок/);
  assert.match(html, /Активировать подарок/);
  assert.match(html, /method="post"/);
  assert.match(html, /\/api\/public\/certificates\//);
  assert.equal(html.includes('14 880'), false);
  assert.equal(html.includes('₽'), false);
});

test('repeated activation keeps a way to contact the specialist and used gifts remain memorable', () => {
  const activated = renderPublicCertificatePage({
    ...baseCertificate,
    activationUrl: 'https://vk.me/example_specialist',
    activationRequestedAt: '2026-11-14T10:00:00.000Z',
  }, 'b'.repeat(64));
  assert.match(activated, /Написать специалисту/);
  const used = renderPublicCertificatePage({ ...baseCertificate, status: 'redeemed' }, 'b'.repeat(64));
  assert.match(used, /Подарок использован/);
  assert.match(used, /Этот подарок уже подарил свои впечатления/);
  assert.doesNotMatch(used, /Активировать подарок/);
});


test('public certificate explains cancelled, expired and contact-unavailable states', () => {
  const cancelled = renderPublicCertificatePage({
    ...baseCertificate,
    status: 'cancelled',
    activationUrl: 'https://vk.me/example_specialist',
  }, 'c'.repeat(64));
  assert.match(cancelled, /Этот сертификат отменён/);
  assert.doesNotMatch(cancelled, /Активировать подарок/);

  const expired = renderPublicCertificatePage({
    ...baseCertificate,
    status: 'expired',
    expiresAt: undefined,
    activationUrl: 'https://vk.me/example_specialist',
  }, 'd'.repeat(64));
  assert.match(expired, /Срок действия сертификата завершён/);
  assert.doesNotMatch(expired, /Активировать подарок/);

  const noContact = renderPublicCertificatePage({
    ...baseCertificate,
    activationUrl: undefined,
  }, 'e'.repeat(64));
  assert.match(noContact, /обратитесь к организации, которая его выдала/);
  assert.doesNotMatch(noContact, /Активировать подарок/);
});

test('brand story includes keyboard navigation, focus visibility and print-friendly output', () => {
  const html = renderPublicCertificatePage({
    ...baseCertificate,
    activationUrl: 'https://vk.me/example_specialist',
  }, 'f'.repeat(64), {
    displayName: 'Тестовый бренд',
    tagline: 'Подарок с историей',
    giftStory: {
      openingEyebrow: 'Подарок',
      openingTitle: 'Дом, который поддерживает',
      openingText: 'История подарка.',
      openingAction: 'Открыть подарок',
      storyEyebrow: 'О доме',
      storyTitle: 'Место для жизни',
      storyText: 'Текст истории.',
      personalMessageTitle: 'Отправитель',
      serviceEyebrow: 'Ваш подарок',
      serviceTitle: 'Разбор дома',
      serviceText: 'Описание.',
      inclusions: [{ title: 'Карта', description: 'PDF' }],
      closingEyebrow: 'Первый шаг',
      closingTitle: 'Пусть дома будет хорошо',
      closingText: 'Свяжитесь со специалистом.',
      activationActionLabel: 'Активировать подарок',
    },
    theme: {
      page: '#f3f0e8', surface: '#fffdf8', ink: '#303329',
      muted: '#77796e', line: '#e4dfd2', accent: '#68765d',
      accentInk: '#ffffff',
    },
  });
  assert.match(html, /class="skip-link" href="#gift-stage-3"/);
  assert.match(html, /a:focus-visible,button:focus-visible/);
  assert.match(html, /@media print/);
  assert.match(html, /aria-label="История подарка"/);
  assert.doesNotMatch(html, /Личный кабинет/);
});

test('Vastu gift story is revealed as five sequential stages with a skippable envelope animation', () => {
  const html = renderPublicCertificatePage({
    ...baseCertificate,
    recipientName: 'Илья и Анна',
    greetingText: 'Дорогие Илья и Анна!',
    senderSignature: 'С теплом, ваши друзья',
    activationUrl: 'https://vk.me/example_specialist',
  }, 'g'.repeat(64), {
    displayName: 'PelzDesign | пространство по васту',
    tagline: 'Подарок, который помогает по-новому почувствовать свой дом.',
    giftStory: {
      openingEyebrow: 'Особенный подарок для вас',
      openingTitle: 'Дом, который поддерживает',
      openingText: 'История подарка.',
      openingAction: 'Открыть подарок',
      storyEyebrow: 'О вашем доме',
      storyTitle: 'Место, где начинается ваша жизнь',
      storyText: 'Дом — это больше, чем стены.',
      personalMessageTitle: 'Несколько слов от того, кто дарит',
      serviceEyebrow: 'Ваш подарок',
      serviceTitle: 'Персональный Васту-разбор дома',
      serviceText: 'Индивидуальные ориентиры для работы с пространством.',
      inclusions: [
        { title: 'Персональная Васту-карта', description: 'Индивидуальная карта в PDF.' },
        { title: 'Голосовой разбор', description: 'Аудиоразбор планировки.' },
        { title: 'Практические рекомендации', description: 'Идеи для вашего пространства.' },
      ],
      closingEyebrow: 'С чего начинается гармония',
      closingTitle: 'Пусть дома вам будет хорошо',
      closingText: 'Свяжитесь со специалистом.',
      activationActionLabel: 'Активировать подарок',
    },
    theme: {
      page: '#f3f0e8', surface: '#fffdf8', ink: '#303329',
      muted: '#77796e', line: '#e4dfd2', accent: '#68765d',
      accentInk: '#ffffff',
    },
  });
  assert.match(html, /data-gift-stage="0"/);
  assert.match(html, /data-gift-stage="1"/);
  assert.match(html, /data-gift-stage="2"/);
  assert.match(html, /data-gift-stage="3"/);
  assert.match(html, /data-gift-stage="4"/);
  assert.match(html, /Для Илья и Анна\. Один особенный подарок для вашего дома/);
  assert.match(html, /data-open-envelope/);
  assert.match(html, /data-skip-envelope/);
  assert.match(html, /Персональная Васту-карта/);
  assert.match(html, /Голосовой разбор/);
  assert.match(html, /Практические рекомендации/);
  assert.match(html, /Активировать подарок/);
  assert.match(html, /Этап 1 из 5/);
  assert.match(html, /Просмотр сертификата не активирует и не погашает его/);
});

test('neutral certificate without a custom story does not render a broken skip link', () => {
  const html = renderPublicCertificatePage(baseCertificate);
  assert.doesNotMatch(html, /class="skip-link"/);
});
