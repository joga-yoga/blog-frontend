import { NextResponse } from 'next/server';
import { getArticles } from '@/lib/api/client';
import { getSiteBaseUrl } from '@/lib/site';

const SITEMAP_LIMIT = 50;
export const revalidate = 3600;

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET() {
  const siteUrl = getSiteBaseUrl();
  const articles = await getArticles({ page: 1, per_page: SITEMAP_LIMIT }, { revalidate });
  const latestUpdate = articles.items[0]?.updated_at ?? new Date().toISOString();

  const urls = [
    {
      loc: `${siteUrl}/`,
      changefreq: 'daily',
      priority: '1.0',
      lastmod: latestUpdate
    },
    {
      loc: `${siteUrl}/artykuly`,
      changefreq: 'daily',
      priority: '0.9',
      lastmod: latestUpdate
    },
    ...articles.items.map((item) => ({
      loc: `${siteUrl}/artykuly/${item.slug}`,
      lastmod: item.updated_at
    }))
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((entry) => {
    const parts = [`    <url>`, `      <loc>${escapeXml(entry.loc)}</loc>`];
    if (entry.lastmod) {
      parts.push(`      <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>`);
    }
    if ('changefreq' in entry && entry.changefreq) {
      parts.push(`      <changefreq>${entry.changefreq}</changefreq>`);
    }
    if ('priority' in entry && entry.priority) {
      parts.push(`      <priority>${entry.priority}</priority>`);
    }
    parts.push('    </url>');
    return parts.join('\n');
  })
  .join('\n')}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=600'
    }
  });
}
