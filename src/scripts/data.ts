import type { OpenDataApp } from '../types';

export function httpsUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || /[\u0000-\u0020<>"']/.test(value)) {
    throw new Error('Directory links must be HTTPS URLs without credentials or unsafe characters.');
  }
  return url.href;
}

export function validateApps(value: unknown): OpenDataApp[] {
  if (!Array.isArray(value)) throw new Error('App directory must be an array.');
  const ids = new Set<number>();
  for (const app of value) {
    if (!app || !Number.isInteger(app.id) || ids.has(app.id) ||
        !['name', 'description', 'url', 'copyright', 'verifiedDate'].every(key => typeof app[key] === 'string') ||
        !Array.isArray(app.category) || !app.category.every((tag: unknown) => typeof tag === 'string') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(app.verifiedDate)) {
      throw new Error('Invalid app directory record.');
    }
    httpsUrl(app.url);
    ids.add(app.id);
  }
  return value;
}

export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
