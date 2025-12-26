import { NextResponse } from 'next/server';
import { getArticles } from '@/lib/api/client';
import { getSiteBaseUrl } from '@/lib/site';

const FEED_LIMIT = 20;
export const revalidate = 300;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET() {
  const siteUrl = getSiteBaseUrl();
  let articles;

  try {
    articles = await getArticles({ page: 1, per_page: FEED_LIMIT }, { revalidate });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[feed.json] Falling back to empty feed because articles could not be fetched.', error);
    articles = { meta: { page: 1, per_page: FEED_LIMIT, total_items: 0, total_pages: 1 }, items: [] };
  }

  const items = articles.items.map((item) => {
    const articleUrl = `${siteUrl}/artykuly/${item.slug}`;
    const summary = item.lead ?? item.title;
    const contentHtml = summary ? `<p>${escapeHtml(summary)}</p>` : undefined;

    return {
      id: articleUrl,
      url: articleUrl,
      title: item.title,
      summary: summary ?? undefined,
      content_html: contentHtml,
      date_published: new Date(item.created_at).toISOString(),
      date_modified: new Date(item.updated_at).toISOString(),
      language: 'pl-PL',
      tags: item.tags
    };
  });

  const body = {
    version: 'https://jsonfeed.org/version/1',
    title: 'joga.yoga – najnowsze artykuły',
    home_page_url: siteUrl,
    feed_url: `${siteUrl}/feed.json`,
    description:
      'Aktualizacje bloga joga.yoga: praktyka jogi, świadome życie i wellbeing. Subskrybuj, aby być na bieżąco.',
    language: 'pl-PL',
    items
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 's-maxage=300, stale-while-revalidate=60'
    }
  });
}
