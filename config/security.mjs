import { createHash } from 'node:crypto';

export const PAGE_BOOTSTRAP = "document.documentElement.classList.add('js');";
export const REFERRER_POLICY = 'no-referrer';

export const csp = {
  algorithm: 'SHA-256',
  directives: [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "font-src 'self'",
    "img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com",
    "connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com",
    'upgrade-insecure-requests',
  ],
  scriptDirective: {
    resources: ["'self'", 'https://www.googletagmanager.com', { resource: "'none'", kind: 'attribute' }],
    hashes: [`sha256-${createHash('sha256').update(PAGE_BOOTSTRAP).digest('base64')}`],
  },
  styleDirective: {
    resources: ["'self'", { resource: "'none'", kind: 'attribute' }],
  },
};

export const responseHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000',
  'Referrer-Policy': REFERRER_POLICY,
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
