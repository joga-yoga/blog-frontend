import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Markdown } from '@/components/Markdown';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { slug: string };
};

type FAQItem = {
  question: string;
  answer: string;
};

type CitationItem = {
  url: string;
  title?: string | null;
  published_at?: string | null;
};

type PostRecord = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  lead: string | null;
  bodyMdx: string | null;
  section: string | null;
  tags: string[] | null;
  faq: unknown;
  citations: unknown;
  createdAt: Date;
  updatedAt: Date;
};

async function getPost(slug: string) {
  const post = await prisma.post.findUnique({
    where: { slug }
  });
  if (!post) {
    return null;
  }

  return post as unknown as PostRecord;
}

function parseFaq(value: unknown): FAQItem[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  const items: FAQItem[] = [];

  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      continue;
    }

    const question = 'question' in item && typeof item.question === 'string' ? item.question.trim() : null;
    const answer = 'answer' in item && typeof item.answer === 'string' ? item.answer.trim() : null;

    if (!question || !answer) {
      continue;
    }

    items.push({ question, answer });
  }

  return items;
}

function parseCitations(value: unknown): CitationItem[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  const items: CitationItem[] = [];

  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      continue;
    }

    const url = 'url' in item && typeof item.url === 'string' ? item.url.trim() : null;
    if (!url) {
      continue;
    }

    const title = 'title' in item && typeof item.title === 'string' ? item.title.trim() : null;
    const published_at =
      'published_at' in item && typeof item.published_at === 'string' ? item.published_at.trim() : null;

    items.push({ url, title, published_at });
  }

  return items;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPost(params.slug);

  if (!post) {
    return {};
  }

  return {
    title: post.title,
    description: post.description ?? post.lead ?? undefined,
    alternates: {
      canonical: `/artykuly/${params.slug}`
    }
  } satisfies Metadata;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long'
  }).format(date);
}

export default async function ArticlePage({ params }: PageProps) {
  const post = await getPost(params.slug);

  if (!post) {
    notFound();
  }

  const faqItems = parseFaq(post.faq);
  const citations = parseCitations(post.citations);
  const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    inLanguage: 'pl-PL',
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
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer
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
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">{post.title}</h1>
        {post.lead ? <p className="max-w-3xl text-lg text-gray-600">{post.lead}</p> : null}
        <div className="text-sm text-gray-500">
          Opublikowano {formatDate(post.createdAt)} • Zaktualizowano {formatDate(post.updatedAt)}
        </div>
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm text-blue-700">
            {tags.map((tag: string) => (
              <li key={tag} className="rounded-full bg-blue-100 px-3 py-1">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {post.bodyMdx ? <Markdown>{post.bodyMdx}</Markdown> : null}

      {faqItems.length ? (
        <section aria-labelledby="faq-heading" className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 id="faq-heading" className="text-2xl font-semibold text-foreground">
            Najczęściej zadawane pytania
          </h2>
          <dl className="mt-4 space-y-6">
            {faqItems.map((item) => (
              <div key={item.question}>
                <dt className="text-lg font-medium text-foreground">{item.question}</dt>
                <dd className="mt-2 text-base text-gray-600">
                  <Markdown className="prose-sm">{item.answer}</Markdown>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {citations.length ? (
        <section aria-labelledby="citations-heading" className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 id="citations-heading" className="text-2xl font-semibold text-foreground">
            Źródła
          </h2>
          <ul className="mt-4 space-y-4">
            {citations.map((citation, index) => (
              <li key={citation.url + index} className="space-y-1">
                <Link href={citation.url} className="text-base font-medium text-blue-700" target="_blank" rel="noreferrer">
                  {citation.title ?? citation.url}
                </Link>
                {citation.published_at ? (
                  <p className="text-sm text-gray-500">{formatDate(new Date(citation.published_at))}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-gray-200 pt-6 text-sm text-gray-500">
        <div>
          Sekcja: <span className="font-medium text-foreground">{post.section ?? 'Ogólne'}</span>
        </div>
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag: string) => (
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
