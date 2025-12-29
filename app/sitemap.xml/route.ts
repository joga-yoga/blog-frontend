import { NextResponse } from 'next/server';
import { getArticles } from '@/lib/api/client';
import { getSiteBaseUrl } from '@/lib/site';

const PER_PAGE = 83;
export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type ArticleItem = {
  slug: string;
  created_at: string;
  updated_at?: string | null;
};

export async function GET() {
  const siteUrl = getSiteBaseUrl();

  try {
    const all: ArticleItem[] = [];
    let page = 1;
    let latestUpdateISO: string | undefined;
    let total: number | undefined;
    let pageSize = PER_PAGE;

    // Paginate through all articles to collect created/updated timestamps
    for (let safety = 0; safety < 400; safety++) {
      const data: any = await getArticles(
        { page, per_page: PER_PAGE },
        { revalidate },
      );

      const maybePerPage = data?.per_page;
      const maybeTotal = data?.total;

      if (
        typeof maybePerPage === 'number' &&
        Number.isFinite(maybePerPage) &&
        maybePerPage > 0
      ) {
        pageSize = maybePerPage;
      }
      if (
        typeof maybeTotal === 'number' &&
        Number.isFinite(maybeTotal) &&
        maybeTotal >= 0
      ) {
        total = maybeTotal;
      }

      const items: ArticleItem[] = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) break;

      // Track latest updated_at/created_at across all posts
      for (const item of items) {
        const ts = item.updated_at || item.created_at;
        if (ts && (!latestUpdateISO || new Date(ts) > new Date(latestUpdateISO))) {
          latestUpdateISO = ts;
        }
      }

      all.push(...items);

      if (items.length < pageSize) break;
      if (typeof total === 'number' && all.length >= total) break;

      page += 1;
    }

    const lastmodForRoot = latestUpdateISO ?? new Date().toISOString();

    const urls = [
      {
        loc: `${siteUrl}/`,
        changefreq: 'daily' as const,
        priority: '1.0' as const,
        lastmod: lastmodForRoot,
      },
      {
        loc: `${siteUrl}/artykuly`,
        changefreq: 'daily' as const,
        priority: '0.9' as const,
        lastmod: lastmodForRoot,
      },
      // One entry per article – lastmod prefers updated_at over created_at
      ...all.map((item) => ({
        loc: `${siteUrl}/artykuly/${item.slug}`,
        lastmod: item.updated_at || item.created_at,
        changefreq: 'weekly' as const,
        priority: '0.8' as const,
      })),
    ];

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((entry) => {
    const parts = [
      `  <url>`,
      `    <loc>${escapeXml(entry.loc)}</loc>`,
    ];

    if (entry.lastmod) {
      // Always output ISO string based on updated_at/created_at
      parts.push(
        `    <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>`,
      );
    }

    if ('changefreq' in entry && entry.changefreq) {
      parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    }

    if ('priority' in entry && entry.priority) {
      parts.push(`    <priority>${entry.priority}</priority>`);
    }

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
    // Fallback sitemap if API fails
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
