import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import { Markdown } from '@/components/Markdown';
import type { PostFull } from '@/types/content';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
};

type PostResult = {
  post: PostFull;
  updated_at: string;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wiedza.joga.yoga';

function buildApiUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

function parseJSON<T>(value: unknown): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  return value as T;
}

function parseTags(value: unknown): string[] | null {
  const parsed = parseJSON<unknown>(value);

  if (!Array.isArray(parsed)) {
    return null;
  }

  const tags = parsed
    .filter((item): item is string => typeof item === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length ? tags : null;
}

function parseFaq(value: unknown): PostFull['faq'] {
  const parsed = parseJSON<unknown>(value);

  if (!Array.isArray(parsed)) {
    return null;
  }

  const items = parsed
    .map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return null;
      }

      const question =
        ('q' in item && typeof item.q === 'string' && item.q.trim()) ||
        ('question' in item && typeof item.question === 'string' && item.question.trim()) ||
        null;
      const answer =
        ('a' in item && typeof item.a === 'string' && item.a.trim()) ||
        ('answer' in item && typeof item.answer === 'string' && item.answer.trim()) ||
        null;

      if (!question || !answer) {
        return null;
      }

      return { q: question, a: answer };
    })
    .filter((item): item is { q: string; a: string } => item !== null);

  return items.length ? items : null;
}

function parseCitations(value: unknown): PostFull['citations'] {
  const parsed = parseJSON<unknown>(value);

  if (!Array.isArray(parsed)) {
    return null;
  }

  const items = parsed
    .map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return null;
      }

      const url = 'url' in item && typeof item.url === 'string' ? item.url.trim() : null;
      if (!url) {
        return null;
      }

      const title =
        ('title' in item && typeof item.title === 'string' && item.title.trim()) ||
        ('label' in item && typeof item.label === 'string' && item.label.trim()) ||
        undefined;
      const date =
        ('date' in item && typeof item.date === 'string' && item.date.trim()) ||
        ('published_at' in item && typeof item.published_at === 'string' && item.published_at.trim()) ||
        undefined;

      return { url, title, date };
    })
    .filter((item) => item !== null);

  return items.length ? items : null;
}

function extractPostObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (
    typeof record.slug === 'string' &&
    typeof record.title === 'string' &&
    typeof record.created_at === 'string'
  ) {
    return record;
  }

  const candidates = ['post', 'data', 'item', 'result'];

  for (const key of candidates) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = extractPostObject(value);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function normalizePost(payload: unknown): PostResult | null {
  const record = extractPostObject(payload);

  if (!record) {
    return null;
  }

  const slug = typeof record.slug === 'string' ? record.slug : null;
  const title = typeof record.title === 'string' ? record.title : null;
  const createdAt = typeof record.created_at === 'string' ? record.created_at : null;

  if (!slug || !title || !createdAt) {
    return null;
  }

  const rawId = (record.id ?? slug) as unknown;
  const id =
    typeof rawId === 'number'
      ? rawId
      : typeof rawId === 'string' && rawId.trim() !== ''
      ? Number.parseInt(rawId, 10)
      : slug;

  const post: PostFull = {
    id,
    slug,
    title,
    lead: typeof record.lead === 'string' ? record.lead : null,
    section: typeof record.section === 'string' ? record.section : null,
    tags: parseTags(record.tags),
    created_at: createdAt,
    description: typeof record.description === 'string' ? record.description : null,
    body_mdx: typeof record.body_mdx === 'string' ? record.body_mdx : '',
    faq: parseFaq(record.faq),
    citations: parseCitations(record.citations),
    locale: typeof record.locale === 'string' ? record.locale : 'pl-PL'
  };

  const updatedAt =
    (typeof record.updated_at === 'string' && record.updated_at.trim() !== ''
      ? record.updated_at
      : null) ?? createdAt;

  return {
    post,
    updated_at: updatedAt
  } satisfies PostResult;
}

async function getPost(slug: string): Promise<PostResult | null> {
  const apiUrl = buildApiUrl(`/api/posts/${slug}`);
  const res = await fetch(apiUrl, { cache: 'no-store' });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Nie udało się pobrać artykułu: ${res.status}`);
  }

  const payload = await res.json();
  return normalizePost(payload);
}

type GenerateMetadataProps = {
  params: PageProps['params'];
};

export async function generateMetadata({ params }: GenerateMetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPost(slug);

  if (!result) {
    return {};
  }

  const canonicalUrl = new URL(`/artykuly/${slug}`, SITE_URL).toString();

  return {
    title: result.post.title,
    description: result.post.description ?? result.post.lead ?? undefined,
    alternates: {
      canonical: canonicalUrl
    }
  } satisfies Metadata;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long'
  }).format(date);
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPost(slug);

  if (!result) {
    notFound();
  }

  const { post, updated_at } = result;
  const faqItems = Array.isArray(post.faq) ? post.faq : [];
  const citations = Array.isArray(post.citations) ? post.citations : [];
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const createdAt = post.created_at;
  const updatedAt = updated_at;
  const canonicalUrl = new URL(`/artykuly/${post.slug}`, SITE_URL).toString();

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: new Date(createdAt).toISOString(),
    dateModified: new Date(updatedAt).toISOString(),
    inLanguage: post.locale,
    description: post.description ?? post.lead ?? undefined,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl
    }
  };

  const faqLd = faqItems.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a
          }
        }))
      }
    : null;

  return (
    <article className="space-y-10">
      <Script id="jsonld-article" type="application/ld+json">
        {JSON.stringify(articleLd)}
      </Script>
      {faqLd ? (
        <Script id="jsonld-faq" type="application/ld+json">
          {JSON.stringify(faqLd)}
        </Script>
      ) : null}

      <header className="space-y-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">{post.section ?? 'Ogólne'}</div>
        <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">{post.title}</h1>
        {post.lead ? <p className="max-w-3xl text-lg text-gray-600">{post.lead}</p> : null}
        <div className="text-sm text-gray-500">
          Opublikowano {formatDate(createdAt)} • Zaktualizowano {formatDate(updatedAt)}
        </div>
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm text-blue-700">
            {tags.map((tag) => (
              <li key={tag} className="rounded-full bg-blue-100 px-3 py-1">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {post.body_mdx ? <Markdown>{post.body_mdx}</Markdown> : null}

      {faqItems.length ? (
        <section aria-labelledby="faq-heading" className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 id="faq-heading" className="text-2xl font-semibold text-slate-900">
            Najczęściej zadawane pytania
          </h2>
          <dl className="mt-4 space-y-6">
            {faqItems.map((item) => (
              <div key={item.q}>
                <dt className="text-lg font-medium text-slate-900">{item.q}</dt>
                <dd className="mt-2 text-base text-gray-600">
                  <Markdown className="prose-sm">{item.a}</Markdown>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {citations.length ? (
        <section aria-labelledby="citations-heading" className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 id="citations-heading" className="text-2xl font-semibold text-slate-900">
            Źródła
          </h2>
          <ul className="mt-4 space-y-4">
            {citations.map((citation, index) => (
              <li key={citation.url + index} className="space-y-1">
                <Link href={citation.url} className="text-base font-medium text-blue-700" target="_blank" rel="noreferrer">
                  {citation.title ?? citation.url}
                </Link>
                {citation.date ? (
                  <p className="text-sm text-gray-500">{formatDate(citation.date)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-gray-200 pt-6 text-sm text-gray-500">
        <div>
          Sekcja: <span className="font-medium text-slate-900">{post.section ?? 'Ogólne'}</span>
        </div>
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-gray-200 px-3 py-1 text-gray-700">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </footer>
    </article>
  );
}
