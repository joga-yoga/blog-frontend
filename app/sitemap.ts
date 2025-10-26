// app/sitemap.ts
import type { MetadataRoute } from 'next';

const SITE = 'https://wiedza.joga.yoga';
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.joga.yoga';

type ArticleSummary = { slug: string; updated_at: string };

async function fetchPage(page: number, per_page = 50) {
  const url = new URL('/artykuly', API);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(per_page));
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<{ items: ArticleSummary[]; total: number; page: number; per_page: number }>;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE}/artykuly`, changeFrequency: 'daily', priority: 0.9 },
  ];

  // собрать все страницы
  let page = 1;
  while (true) {
    const data = await fetchPage(page);
    for (const it of data.items) {
      entries.push({
        url: `${SITE}/artykuly/${it.slug}`,
        lastModified: new Date(it.updated_at),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
    if (data.items.length < data.per_page) break;
    page += 1;
  }

  return entries;
}
