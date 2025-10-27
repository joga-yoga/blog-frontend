const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wiedza.joga.yoga';
const API  = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';
const PER_PAGE = 50;

type ApiItem = {
  slug: string;
  title: string;
  section: string | null;
  lead?: string | null;
  tags: string[];
  created_at: string; // ISO
  updated_at: string; // ISO
};

type AnyResponse = {
  items?: ApiItem[];
  [k: string]: unknown;
};

function xmlEscape(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildXml(urls: {
  loc: string;
  lastmod?: string;           // ISO 8601
  changefreq?: 'always'|'hourly'|'daily'|'weekly'|'monthly'|'yearly'|'never';
  priority?: number;          // 0.0 – 1.0
}[]): string {
  const items = urls.map(u => {
    const parts = [
      `<loc>${xmlEscape(u.loc)}</loc>`,
      u.lastmod ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` : '',
      u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : '',
      typeof u.priority === 'number' ? `<priority>${u.priority.toFixed(1)}</priority>` : '',
    ].filter(Boolean).join('');
    return `<url>${parts}</url>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    items +
    `</urlset>`;
}

export async function GET(): Promise<Response> {
  const nowIso = new Date().toISOString();

  const urls: { loc: string; lastmod?: string; changefreq?: any; priority?: number }[] = [
    { loc: `${BASE}/`,              lastmod: nowIso, changefreq: 'weekly', priority: 1.0 },
    { loc: `${BASE}/privacy-policy`, lastmod: nowIso, changefreq: 'yearly', priority: 0.3 },
  ];

  let page = 1;
  while (true) {
    const res = await fetch(
      `${API}/articles?page=${page}&per_page=${PER_PAGE}`,
      { next: { revalidate: 60, tags: ['articles'] } }
    );
    if (!res.ok) break;

    const data = (await res.json()) as AnyResponse;
    const items = Array.isArray(data.items) ? data.items as ApiItem[] : [];

    for (const it of items) {
      urls.push({
        loc: `${BASE}/artykuly/${it.slug}`,
        lastmod: new Date(it.updated_at ?? it.created_at).toISOString(),
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    if (items.length < PER_PAGE) break;
    page += 1;
  }

  const xml = buildXml(urls);
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60', 
    },
  });
}
