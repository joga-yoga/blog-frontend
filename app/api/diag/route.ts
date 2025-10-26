import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api/client';

export async function GET() {
  const base = getApiBaseUrl();
  const out: any = {
    env_seen: {
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
    },
    base_url: base,
    checks: {} as Record<string, unknown>,
  };

  async function probe(path: string) {
    try {
      const url = `${base.replace(/\/$/, '')}${path}`;
      const r = await fetch(url, { cache: 'no-store' });
      const ct = r.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await r.json().catch(() => null) : await r.text().catch(() => null);
      return { ok: r.ok, status: r.status, url, sample: body && (typeof body === 'string' ? body.slice(0, 200) : body) };
    } catch (e: any) {
      return { ok: false, error: String(e) };
    }
  }

  out.checks.health = await probe('/health');
  out.checks.articles = await probe('/artykuly?per_page=1&page=1');

  return NextResponse.json(out);
}
