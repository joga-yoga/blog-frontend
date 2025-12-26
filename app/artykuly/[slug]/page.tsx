import Link from 'next/link';
import Script from 'next/script';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/Markdown';
import { getArticle, getArticles, MAX_PER_PAGE, NotFoundError } from '@/lib/api/client';
import {
  articleDetailResponseSchema,
  type ArticleCitation,
  type ArticleDetailResponse,
  type ArticleFaqItem
} from '@/lib/api/types';
import { assertValidCanonical, buildArticleCanonical } from '@/lib/site';
import { ReadAlsoSection } from '@/components/ReadAlsoSection';
import { resolveArticleReferences, type InternalRecommendation } from '@/lib/article-references';
import { extractExternalCitations } from '@/lib/citations';

export const revalidate = 0; // TODO: Restore incremental static regeneration once canonical changes are fully deployed.

type PageParams = { slug: string };

type PageProps = {
  params: Promise<PageParams>;
};

type GenerateMetadataProps = {
  params: PageProps['params'];
};

type FallbackRecommendationsInput = {
  currentSlug: string;
  currentSection?: string | null;
};

type ArticleSeo = {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  robots?: string | null;
  slug?: string;
};

type ArticleTaxonomy = {
  section?: string | null;
  categories: string[];
  tags: string[];
};

type ArticleBody = {
  headline: string;
  lead?: string | null;
  sections: Array<{ title: string; body: string }>;
  citations?: ArticleCitation[];
};

type ArticleForRendering = ArticleDetailResponse & {
  seo: ArticleSeo;
  taxonomy: ArticleTaxonomy;
  article: ArticleBody;
  aeo: { faq: ArticleFaqItem[]; geo_focus: string[] };
  created_at?: string | null;
  updated_at?: string | null;
  slug: string;
  locale: string;
};

function validateArticlePayload(payload: unknown, slug: string): ArticleForRendering {
  const parsed = articleDetailResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Invalid article payload for slug "${slug}"`, { cause: parsed.error });
  }

  const base = parsed.data;

  return {
    ...base,
    seo: { ...base.seo },
    taxonomy: {
      section: base.taxonomy?.section ?? null,
      categories: base.taxonomy?.categories ?? [],
      tags: base.taxonomy?.tags ?? []
    },
    article: {
      ...base.article,
      lead: base.article.lead ?? null,
      citations: base.article.citations ?? []
    },
    aeo: {
      geo_focus: base.aeo?.geo_focus ?? [],
      faq: base.aeo?.faq ?? []
    },
    created_at: base.created_at ?? null,
    updated_at: base.updated_at ?? null,
    slug: base.slug,
    locale: base.locale
  } satisfies ArticleForRendering;
}

function formatDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' }).format(date);
}

function normalizeFaqForSchema(items: ArticleFaqItem[] | null | undefined): ArticleFaqItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const seenQuestions = new Set<string>();

  return items
    .map((item) => ({
      question: item.question.replace(/\s+/g, ' ').trim(),
      answer: item.answer.replace(/\s+/g, ' ').trim()
    }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0)
    .filter((item) => {
      const normalizedQuestion = item.question.toLocaleLowerCase('pl-PL');
      if (seenQuestions.has(normalizedQuestion)) {
        return false;
      }
      seenQuestions.add(normalizedQuestion);
      return true;
    });
}

function buildArticleJsonLd(article: ArticleForRendering, canonicalUrl: string) {
  const createdAt = article.created_at ?? article.updated_at ?? new Date().toISOString();
  const updatedAt = article.updated_at ?? createdAt;
  const description = article.seo.description ?? article.article.lead;
  const keywords = article.taxonomy?.tags;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.article.headline,
    description,
    url: canonicalUrl,
    datePublished: new Date(createdAt).toISOString(),
    dateModified: new Date(updatedAt).toISOString(),
    inLanguage: article.locale,
    keywords,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl
    }
  };
}

function buildFaqJsonLd(faq: ArticleFaqItem[]) {
  // FAQ JSON-LD is emitted only when >=2 valid items.
  if (faq.length < 2) {
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

async function buildFallbackRecommendations({ currentSlug, currentSection }: FallbackRecommendationsInput): Promise<InternalRecommendation[]> {
  const list = await getArticles({ per_page: MAX_PER_PAGE }, { revalidate });
  const candidates = list.items.filter((item) => item.slug !== currentSlug);
  const sameSection = candidates.filter((item) => item.section && item.section === currentSection);
  const otherSections = candidates.filter((item) => !currentSection || item.section !== currentSection);

  const selected = new Map<string, (typeof candidates)[number]>();

  for (const item of sameSection) {
    if (selected.size >= 2) break;
    selected.set(item.slug, item);
  }

  if (selected.size < 3 && otherSections.length > 0) {
    const shuffled = [...otherSections].sort(() => Math.random() - 0.5);
    for (const item of shuffled) {
      if (selected.size >= 3) break;
      selected.set(item.slug, item);
    }
  }

  if (selected.size < 3) {
    for (const item of candidates) {
      if (selected.size >= 3) break;
      if (!selected.has(item.slug)) {
        selected.set(item.slug, item);
      }
    }
  }

  return Array.from(selected.values()).map((item) => ({
    slug: item.slug,
    title: item.title,
    lead: item.lead ?? undefined,
    section: item.section ?? undefined
  }));
}

export async function generateMetadata({ params }: GenerateMetadataProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const article = validateArticlePayload(await getArticle(slug, { revalidate }), slug);
    const canonicalSource = article.seo.canonical?.trim();
    const canonicalUrl = assertValidCanonical(
      canonicalSource && canonicalSource.length > 0 ? canonicalSource : buildArticleCanonical(article.slug)
    );
    const createdAt = article.created_at ?? article.updated_at ?? undefined;
    const updatedAt = article.updated_at ?? article.created_at ?? undefined;
    const robotsValue = article.seo.robots?.toLowerCase() ?? '';
    const robots = {
      index: !robotsValue.includes('noindex'),
      follow: !robotsValue.includes('nofollow')
    };

    const title = article.seo.title ?? article.article.headline;
    const description = article.seo.description ?? article.article.lead;
    const tags = article.taxonomy?.tags ?? [];

    return {
      title,
      description,
      alternates: {
        canonical: canonicalUrl
      },
      keywords: tags,
      openGraph: {
        type: 'article',
        locale: article.locale,
        title,
        description,
        url: canonicalUrl,
        tags,
        section: article.taxonomy?.section,
        publishedTime: createdAt ?? undefined,
        modifiedTime: updatedAt ?? undefined
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
  const { slug } = await params;
  let articlePayload: ArticleDetailResponse;

  try {
    articlePayload = await getArticle(slug, { revalidate });
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const article = validateArticlePayload(articlePayload, slug);

  const faqItems = normalizeFaqForSchema(article.aeo?.faq);
  const taxonomy = article.taxonomy ?? { section: '', categories: [], tags: [] };
  const articleSections = Array.isArray(article.article.sections) ? article.article.sections : [];
  const { internalRecommendations, consumedSectionIndexes } = resolveArticleReferences(article);
  const { externalCitations, internalRecommendations: citationRecommendations } = extractExternalCitations(article);

  const mergedRecommendations = [
    ...citationRecommendations,
    ...internalRecommendations
  ].reduce<InternalRecommendation[]>((acc, recommendation) => {
    if (acc.some((item) => item.slug === recommendation.slug)) {
      return acc;
    }
    acc.push(recommendation);
    return acc;
  }, []);

  const resolvedRecommendations =
    mergedRecommendations.length > 0
      ? mergedRecommendations
      : await buildFallbackRecommendations({ currentSlug: article.slug, currentSection: taxonomy.section });
  const readAlsoItems = resolvedRecommendations.map((item) => ({
    title: item.title,
    href: `/artykuly/${item.slug}`,
    snippet: item.lead ?? item.section ?? ''
  }));
  const contentSections = articleSections.filter((_, index) => !consumedSectionIndexes.has(index));
  const createdAt = formatDate(article.created_at ?? article.updated_at ?? undefined);
  const updatedAt = formatDate(article.updated_at ?? article.created_at ?? undefined);
  const canonicalSource = article.seo.canonical?.trim();
  const canonicalUrl = assertValidCanonical(
    canonicalSource && canonicalSource.length > 0 ? canonicalSource : buildArticleCanonical(article.slug)
  );

  const articleJsonLd = buildArticleJsonLd(article, canonicalUrl);
  const faqJsonLd = buildFaqJsonLd(faqItems);
  const uniqueTags = Array.from(new Set(taxonomy.tags));

  return (
    <article className="space-y-10">
      <Script id="jsonld-article" type="application/ld+json">
        {JSON.stringify(articleJsonLd)}
      </Script>
      {faqJsonLd ? (
        <Script id="jsonld-faq" type="application/ld+json">{JSON.stringify(faqJsonLd)}</Script>
      ) : null}

      <header className="space-y-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">{taxonomy.section}</div>
        <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">{article.article.headline}</h1>
        {article.article.lead ? <p className="max-w-3xl text-lg text-gray-600">{article.article.lead}</p> : null}
        <div className="text-sm text-gray-500">
          {createdAt ? <>Opublikowano {createdAt}</> : null}
          {updatedAt ? <span className="ml-2">• Zaktualizowano {updatedAt}</span> : null}
        </div>
        {uniqueTags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm text-blue-700">
            {uniqueTags.map((tag, index) => (
              <li key={`${tag}-${index}`} className="rounded-full bg-blue-100 px-3 py-1">
                <Link href={`/?q=${encodeURIComponent(tag)}`}>#{tag}</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="space-y-10">
        {contentSections.map((section, index) => (
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

      {externalCitations.length > 0 ? (
        <section aria-labelledby="sources-heading" className="space-y-3">
          <h2 id="sources-heading" className="text-2xl font-semibold text-slate-900">
            Źródła
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-base text-blue-800">
            {externalCitations.map((citation) => (
              <li key={citation.url} className="break-words">
                <a href={citation.url} className="hover:underline" target="_blank" rel="noreferrer">
                  {citation.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ReadAlsoSection items={readAlsoItems} />

      <footer className="border-t border-gray-50 pt-6 text-sm text-gray-500">
        <div>
          Sekcja: <span className="font-medium text-slate-900">{taxonomy.section}</span>
        </div>
        {taxonomy.categories.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {taxonomy.categories.map((category) => (
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
