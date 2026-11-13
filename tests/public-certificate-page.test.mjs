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
  assert.match(html, /Открытие страницы не изменяет его статус/);
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
