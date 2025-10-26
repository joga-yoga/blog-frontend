import { NextResponse } from 'next/server';
import { getArticles } from '@/lib/api/client';
import { getSiteBaseUrl } from '@/lib/site';

const PER_PAGE = 50;
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

    const all = [];
    let page = 1;
    let latestUpdateISO: string | undefined;

    for (let safety = 0; safety < 400; safety++) { 
      const data = await getArticles({ page, per_page: PER_PAGE }, { revalidate });


      for (const item of data.items) {
        const ts = item.updated_at || item.created_at;
        if (ts && (!latestUpdateISO || new Date(ts) > new Date(latestUpdateISO))) {
          latestUpdateISO = ts;
        }
      }

      all.push(...data.items);


      if (data.items.length < data.per_page) break;
      page += 1;
    }


    const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = [
      {
        loc: `${siteUrl}/`,
        changefreq: 'daily',
        priority: '1.0',
        lastmod: latestUpdateISO ?? new Date().toISOString(),
      },

      {
        loc: `${siteUrl}/artykuly`,
        changefreq: 'daily',
        priority: '0.9',
        lastmod: latestUpdateISO ?? new Date().toISOString(),
      },
      ...all.map((item) => ({
        loc: `${siteUrl}/artykuly/${item.slug}`,
        lastmod: item.updated_at || item.created_at,
        changefreq: 'weekly',
        priority: '0.8',
      })),
    ];


    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((entry) => {
    const parts = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
    if (entry.lastmod) parts.push(`    <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>`);
    if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
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
  } catch (err) {

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
