import { NextResponse } from 'next/server';
import { getArticles } from '@/lib/api/client';
import { getSiteBaseUrl } from '@/lib/site';

const FEED_LIMIT = 20;
export const revalidate = 300;

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET() {
  const siteUrl = getSiteBaseUrl();
  const feedUrl = `${siteUrl}/feed.xml`;
  const articles = await getArticles({ page: 1, per_page: FEED_LIMIT }, { revalidate });

  const updated = articles.items[0]?.updated_at ?? new Date().toISOString();

  const entries = articles.items
    .map((item) => {
      const articleUrl = `${siteUrl}/artykuly/${item.slug}`;
      const summary = item.lead ?? item.title;
      const categories = item.tags.length
        ? `\n      ${item.tags.map((tag) => `<category term="${escapeXml(tag)}" />`).join('\n      ')}`
        : '';

      return `    <entry>
      <id>${escapeXml(articleUrl)}</id>
      <title>${escapeXml(item.title)}</title>
      <link rel="alternate" href="${escapeXml(articleUrl)}" />
      <updated>${new Date(item.updated_at).toISOString()}</updated>
      <published>${new Date(item.created_at).toISOString()}</published>
      <summary type="html"><p>${summary ? escapeXml(summary) : ''}</p></summary>${categories}
    </entry>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pl-PL">
  <id>${escapeXml(siteUrl)}/</id>
  <title>joga.yoga – najnowsze artykuły</title>
  <updated>${new Date(updated).toISOString()}</updated>
  <link rel="self" href="${escapeXml(feedUrl)}" />
  <link rel="alternate" href="${escapeXml(siteUrl)}" />
  <subtitle>Aktualizacje bloga joga.yoga: praktyka jogi, świadome życie i wellbeing.</subtitle>
${entries}
</feed>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 's-maxage=300, stale-while-revalidate=60'
    }
  });
}
