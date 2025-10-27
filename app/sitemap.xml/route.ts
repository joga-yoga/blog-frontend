import { NextResponse } from 'next/server';
import { getArticles } from '@/lib/api/client';
import { getSiteBaseUrl } from '@/lib/site';

const PER_PAGE = 50;           // дефолт на случай, если бэкенд не вернет per_page
export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const siteUrl = getSiteBaseUrl();

  try {
    const all: Array<{
      slug: string;
      updated_at?: string;
      created_at: string;
    }> = [];
    let page = 1;
    let latestUpdateISO: string | undefined;
    let total: number | undefined; // возьмем из ответа, если есть
    let pageSize = PER_PAGE;       // актуальный размер страницы

    // мягкий предохранитель от бесконечного цикла
    for (let safety = 0; safety < 400; safety++) {
      const data = await getArticles({ page, per_page: PER_PAGE }, { revalidate });

      // Забираем фактический per_page и total, если клиент/бек их отдает
      const maybePerPage = (data as any)?.per_page;
      const maybeTotal   = (data as any)?.total;

      if (typeof maybePerPage === 'number' && Number.isFinite(maybePerPage) && maybePerPage > 0) {
        pageSize = maybePerPage;
      }
      if (typeof maybeTotal === 'number' && Number.isFinite(maybeTotal) && maybeTotal >= 0) {
        total = maybeTotal;
      }

      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) break;

      // собираем все статьи и вычисляем самый свежий lastmod
      for (const item of items) {
        const ts = item.updated_at || item.created_at;
        if (ts && (!latestUpdateISO || new Date(ts) > new Date(latestUpdateISO))) {
          latestUpdateISO = ts;
        }
      }
      all.push(...items);

      // два независимых стоп-сигнала:
      // 1) пришла неполная страница
      if (items.length < pageSize) break;
      // 2) мы уже покрыли total
      if (typeof total === 'number' && all.length >= total) break;

      page += 1;
    }

    const lastmodForRoot = latestUpdateISO ?? new Date().toISOString();

    const urls = [
      {
        loc: `${siteUrl}/`,
        changefreq: 'daily',
        priority: '1.0',
        lastmod: lastmodForRoot,
      },
      {
        loc: `${siteUrl}/artykuly`,
        changefreq: 'daily',
        priority: '0.9',
        lastmod: lastmodForRoot,
      },
      ...all.map((item) => ({
        loc: `${siteUrl}/artykuly/${item.slug}`,
        lastmod: item.updated_at || item.created_at,
        changefreq: 'weekly' as const,
        priority: '0.8',
      })),
    ];

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((entry) => {
    const parts = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
    if (entry.lastmod) parts.push(`    <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>`);
    if ('changefreq' in entry && entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    if ('priority' in entry && entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
    parts.push('  </url>');
    return parts.join('\n');
  })
  .join('\n')}
</urlset>`;

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch {
    // fail-safe: отдадим минимальный sitemap, чтобы сайт и деплой не падали
    const now = new Date().toISOString();
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(`${siteUrl}/`)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${escapeXml(`${siteUrl}/artykuly`)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;
    return new NextResponse(fallback, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 's-maxage=600',
      },
    });
  }
}
