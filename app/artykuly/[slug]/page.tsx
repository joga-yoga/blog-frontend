import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Markdown } from '@/components/Markdown';
import type { PostFull } from '@/types/content';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { slug: string };
};

type PostQueryRow = Omit<PostFull, 'tags' | 'faq' | 'citations' | 'body_mdx'> & {
  tags: unknown;
  faq: unknown;
  citations: unknown;
  body_mdx: string | null;
  updated_at: string | null;
};

type PostResult = {
  post: PostFull;
  updated_at: string;
};

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
    .filter((item): item is { url: string; title?: string; date?: string } => item !== null);

  return items.length ? items : null;
}

async function getPost(slug: string): Promise<PostResult | null> {
  const rows = await prisma.$queryRaw<PostQueryRow[]>`
    SELECT id, slug, title, description, lead, body_mdx, section, tags, faq, citations, created_at, locale, updated_at
    FROM posts
    WHERE slug = ${slug}
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  const post: PostFull = {
    ...row,
    tags: parseTags(row.tags),
    faq: parseFaq(row.faq),
    citations: parseCitations(row.citations),
    body_mdx: row.body_mdx ?? ''
  };

  return {
    post,
    updated_at: row.updated_at ?? row.created_at
  } satisfies PostResult;
}

type GenerateMetadataProps = {
  params: Promise<PageProps['params']>;
};

export async function generateMetadata({ params }: GenerateMetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPost(slug);

  if (!result) {
    return {};
  }

  return {
    title: result.post.title,
    description: result.post.description ?? result.post.lead ?? undefined,
    alternates: {
      canonical: `/artykuly/${slug}`
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
  const result = await getPost(params.slug);

  if (!result) {
    notFound();
  }

  const { post, updated_at } = result;
  const faqItems = post.faq ?? [];
  const citations = post.citations ?? [];
  const tags = post.tags ?? [];
  const createdAt = post.created_at;
  const updatedAt = updated_at;

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
      '@id': `/artykuly/${post.slug}`
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
