

export const dynamic = 'force-dynamic';   // не строим на билде
export const revalidate = 0;
export const fetchCache = 'default-no-store';

const ENV_BASE = process.env.NEXT_PUBLIC_SITE_URL; 
const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'https://api.joga.yoga';

const PER_PAGE = 50;
const MAX_PAGES_GUARD = 100;

type ApiItem = {
  slug: string;
  title: string;
  section: string | null;
  lead?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type ApiResp =
  | { page?: number; per_page?: number; total?: number; items?: ApiItem[] }
  | { meta?: { page?: number; per_page?: number; total_pages?: number }; items?: ApiItem[] };

function xmlEscape(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildXml(urls: { loc: string; lastmod?: string; changefreq?: string; priority?: number }) {
  const body = urls
    .map((u) => {
      const parts = [
        `<loc>${xmlEscape(u.loc)}</loc>`,
        u.lastmod ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` : '',
        u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : '',
        typeof u.priority === 'number' ? `<priority>${u.priority.toFixed(1)}</priority>` : '',
      ]
        .filter(Boolean)
        .join('');
      return `<url>${parts}</url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>` +
         `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
         body +
         `</urlset>`;
}

function isLocal(value?: string) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return ['localhost', '127.0.0.1'].includes(u.hostname);
  } catch {
    return true;
  }
}

function resolveBase(req: Request): string {
  if (ENV_BASE && !isLocal(ENV_BASE)) return ENV_BASE;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'wiedza.joga.yoga';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function GET(req: Request): Promise<Response> {
  const BASE = resolveBase(req);
  const nowIso = new Date().toISOString();

  const urls: { loc: string; lastmod?: string; changefreq?: string; priority?: number }[] = [
    { loc: `${BASE}/`,              lastmod: nowIso, changefreq: 'weekly', priority: 1.0 },
    { loc: `${BASE}/privacy-policy`, lastmod: nowIso, changefreq: 'yearly', priority: 0.3 },
  ];

  // если API «локальный» — отдать базовый sitemap и не падать
  if (isLocal(API)) {
    const xml = buildXml(urls);
    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    });
  }

  let page = 1;
  let totalPages: number | undefined;
  let guard = 0;

  try {
    while (guard++ < MAX_PAGES_GUARD) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${API}/articles?page=${page}&per_page=${PER_PAGE}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) break;

      const raw = (await res.json()) as ApiResp;
      const items = Array.isArray((raw as any).items) ? ((raw as any).items as ApiItem[]) : [];

      if (!totalPages && (raw as any)?.meta?.total_pages) {
        totalPages = Number((raw as any).meta.total_pages) || undefined;
      }

      for (const it of items) {
        urls.push({
          // если реальный маршрут у тебя /posts/[slug], замени на /posts
          loc: `${BASE}/artykuly/${it.slug}`,
          lastmod: new Date(it.updated_at ?? it.created_at).toISOString(),
          changefreq: 'weekly',
          priority: 0.8,
        });
      }

      if (typeof totalPages === 'number' && page >= totalPages) break;
      if (items.length < PER_PAGE) break;

      page += 1;
    }
  } catch {
    // fail-safe: отдать то, что уже собрали
  }

  const xml = buildXml(urls);
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
}
