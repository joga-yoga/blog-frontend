import Link from 'next/link';
import Script from 'next/script';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/Markdown';
import { getArticle, NotFoundError } from '@/lib/api/client';
import type { ArticleCitation, ArticleDetailResponse, ArticleFaqItem } from '@/lib/api/types';

export const revalidate = 600;

type PageProps = {
  params: { slug: string };
};

type GenerateMetadataProps = {
  params: PageProps['params'];
};

function formatDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' }).format(date);
}

function mapFaq(items: ArticleFaqItem[]): ArticleFaqItem[] {
  return items.map((item) => ({
    question: item.question.trim(),
    answer: item.answer.trim()
  }));
}

function buildArticleJsonLd(article: ArticleDetailResponse) {
  const createdAt = article.created_at ?? article.updated_at ?? new Date().toISOString();
  const updatedAt = article.updated_at ?? createdAt;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.article.headline,
    description: article.seo.description,
    datePublished: new Date(createdAt).toISOString(),
    dateModified: new Date(updatedAt).toISOString(),
    inLanguage: article.locale,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.seo.canonical ?? `/artykuly/${article.slug}`
    }
  };
}

function buildFaqJsonLd(faq: ArticleFaqItem[]) {
  if (faq.length === 0) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  };
}

function normalizeCitations(citations: ArticleCitation[]): ArticleCitation[] {
  return citations
    .map((citation) => ({
      url: citation.url?.trim(),
      label: citation.label.trim()
    }))
    .filter((item) => item.label.length > 0);
}

export async function generateMetadata({ params }: GenerateMetadataProps): Promise<Metadata> {
  try {
    const article = await getArticle(params.slug, { revalidate });
    const createdAt = article.created_at ?? article.updated_at;
    const updatedAt = article.updated_at ?? article.created_at;
    const robotsValue = article.seo.robots?.toLowerCase() ?? '';
    const robots = robotsValue
      ? {
          index: !robotsValue.includes('noindex'),
          follow: !robotsValue.includes('nofollow')
        }
      : undefined;

    return {
      title: article.seo.title ?? article.article.headline,
      description: article.seo.description ?? article.article.lead,
      alternates: {
        canonical: article.seo.canonical ?? `/artykuly/${article.slug}`
      },
      keywords: article.taxonomy.tags,
      openGraph: {
        type: 'article',
        locale: article.locale,
        title: article.seo.title ?? article.article.headline,
        description: article.seo.description ?? article.article.lead,
        url: article.seo.canonical ?? `/artykuly/${article.slug}`,
        tags: article.taxonomy.tags,
        section: article.taxonomy.section,
        publishedTime: createdAt,
        modifiedTime: updatedAt
      },
      robots
    } satisfies Metadata;
  } catch (error) {
    if (error instanceof NotFoundError) {
      return {
        title: 'Artykuł niedostępny',
        description: 'Nie znaleziono żądanego artykułu.'
      } satisfies Metadata;
    }
    throw error;
  }
}

export default async function ArticlePage({ params }: PageProps) {
  let article: ArticleDetailResponse;

  try {
    article = await getArticle(params.slug, { revalidate });
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const faqItems = mapFaq(article.aeo.faq);
  const citations = normalizeCitations(article.article.citations);
  const createdAt = formatDate(article.created_at ?? article.updated_at ?? undefined);
  const updatedAt = formatDate(article.updated_at ?? article.created_at ?? undefined);

  const articleJsonLd = buildArticleJsonLd(article);
  const faqJsonLd = buildFaqJsonLd(faqItems);

  return (
    <article className="space-y-10">
      <Script id="jsonld-article" type="application/ld+json">
        {JSON.stringify(articleJsonLd)}
      </Script>
      {faqJsonLd ? (
        <Script id="jsonld-faq" type="application/ld+json">{JSON.stringify(faqJsonLd)}</Script>
      ) : null}

      <header className="space-y-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">{article.taxonomy.section}</div>
        <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">{article.article.headline}</h1>
        {article.article.lead ? <p className="max-w-3xl text-lg text-gray-600">{article.article.lead}</p> : null}
        <div className="text-sm text-gray-500">
          {createdAt ? <>Opublikowano {createdAt}</> : null}
          {updatedAt ? <span className="ml-2">• Zaktualizowano {updatedAt}</span> : null}
        </div>
        {article.taxonomy.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm text-blue-700">
            {article.taxonomy.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-blue-100 px-3 py-1">
                <Link href={`/?q=${encodeURIComponent(tag)}`}>#{tag}</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="space-y-10">
        {article.article.sections.map((section, index) => (
          <section key={`${index}-${section.title}`} className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">{section.title}</h2>
            <Markdown>{section.body}</Markdown>
          </section>
        ))}
      </div>

      {faqItems.length > 0 ? (
        <section aria-labelledby="faq-heading" className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 id="faq-heading" className="text-2xl font-semibold text-slate-900">
            Najczęściej zadawane pytania
          </h2>
          <dl className="mt-4 space-y-6">
            {faqItems.map((item) => (
              <div key={item.question}>
                <dt className="text-lg font-medium text-slate-900">{item.question}</dt>
                <dd className="mt-2 text-base text-gray-600">
                  <Markdown className="prose-sm">{item.answer}</Markdown>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {citations.length > 0 ? (
        <section aria-labelledby="citations-heading" className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 id="citations-heading" className="text-2xl font-semibold text-slate-900">
            Źródła
          </h2>
          <ul className="mt-4 space-y-4">
            {citations.map((citation, index) => {
              const isExternal = citation.url?.startsWith('http');
              return (
                <li key={`${citation.label}-${index}`} className="space-y-1">
                  {citation.url ? (
                    <Link
                      href={citation.url}
                      className="text-base font-medium text-blue-700"
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noreferrer' : undefined}
                    >
                      {citation.label}
                    </Link>
                  ) : (
                    <p className="text-base text-gray-700">{citation.label}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-gray-200 pt-6 text-sm text-gray-500">
        <div>
          Sekcja: <span className="font-medium text-slate-900">{article.taxonomy.section}</span>
        </div>
        {article.taxonomy.categories.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {article.taxonomy.categories.map((category) => (
              <span key={category} className="rounded-full bg-gray-200 px-3 py-1 text-gray-700">
                {category}
              </span>
            ))}
          </div>
        ) : null}
        {article.aeo.geo_focus.length > 0 ? (
          <p className="mt-2">Obszary geograficzne: {article.aeo.geo_focus.join(', ')}</p>
        ) : null}
      </footer>
    </article>
  );
}
