const DEFAULT_SITE_URL = 'https://wiedza.joga.yoga';

export function getSiteBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
  return value.replace(/\/$/, '');
}
