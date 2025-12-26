import { parseReadAlsoItems } from '@/components/ReadAlsoSection';
import type { ArticleDetailResponse, ArticleCitation } from '@/lib/api/types';

export type ExternalCitation = { url?: string; label?: string };

export type InternalRecommendation = {
  slug: string;
  title: string;
  lead?: string;
  section?: string;
};

type ResolveArticleReferencesOptions = {
  enableDebugLog?: boolean;
};

type ArrayLikeValue<T> = T | T[] | { data?: T[]; items?: T[] } | null | undefined;

const CITATIONS_TITLE_VARIANTS = ['źródła', 'zrodla', 'sources', 'źródła / citations'];
const READ_ALSO_TITLE_VARIANTS = [
  'przeczytaj również',
  'przeczytaj rowniez',
  'przeczytaj także',
  'przeczytaj takze',
  'czytaj także',
  'czytaj takze',
  'czytaj również',
  'czytaj rowniez',
  'read also',
  'polecane artykuły',
  'polecane artykuly',
  'rekomendowane artykuły',
  'rekomendowane artykuly'
];

const normalizeTitle = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLocaleLowerCase('pl-PL');
};

const toArray = <T>(value: ArrayLikeValue<T>): T[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) {
      return value.items as T[];
    }

    if (Array.isArray((value as { data?: unknown }).data)) {
      return (value as { data: T[] }).data;
    }
  }

  return [];
};

const normalizeCitation = (entry: unknown): ExternalCitation | null => {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const normalized = entry.trim();
    if (!normalized) return null;
    return { url: normalized, label: normalized } satisfies ExternalCitation;
  }

  if (typeof entry === 'object') {
    const value = entry as Partial<ArticleCitation> & { href?: string; title?: string; name?: string; description?: string };
    const url = typeof value.url === 'string' && value.url.trim() ? value.url.trim() : value.href?.trim();
    const labelCandidate = value.label ?? value.title ?? value.name ?? value.description ?? url;
    const label = typeof labelCandidate === 'string' && labelCandidate.trim() ? labelCandidate.trim() : undefined;

    if (!url && !label) {
      return null;
    }

    return { url: url ?? undefined, label } satisfies ExternalCitation;
  }

  return null;
};

const normalizeInternalRecommendation = (entry: unknown): InternalRecommendation | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const value = entry as {
    slug?: string;
    title?: string;
    headline?: string;
    lead?: string;
    description?: string;
    section?: string;
    href?: string;
    url?: string;
    path?: string;
    article?: { headline?: string; lead?: string; slug?: string };
    post?: { title?: string; headline?: string; lead?: string; slug?: string; section?: string };
    taxonomy?: { section?: string };
  };

  const slugSource =
    value.slug ??
    value.article?.slug ??
    value.post?.slug ??
    value.path ??
    value.url ??
    value.href ??
    null;

  let slug: string | null = null;
  if (typeof slugSource === 'string') {
    const trimmed = slugSource.trim();
    if (trimmed) {
      try {
        const parsedUrl = new URL(trimmed, 'https://placeholder.invalid');
        const segments = parsedUrl.pathname.split('/').filter(Boolean);
        slug = segments.pop() ?? trimmed;
      } catch {
        const normalized = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
        slug = normalized.split('/').pop() ?? normalized;
      }
    }
  }

  const title =
    value.title ??
    value.headline ??
    value.article?.headline ??
    value.post?.headline ??
    value.post?.title ??
    undefined;

  if (!slug || !title) {
    return null;
  }

  const lead = value.lead ?? value.description ?? value.article?.lead ?? value.post?.lead;
  const section = value.section ?? value.post?.section ?? value.taxonomy?.section;

  return {
    slug,
    title,
    lead: lead ?? undefined,
    section: section ?? undefined
  } satisfies InternalRecommendation;
};

const parseCitationsFromSection = (body: string | null | undefined): ExternalCitation[] => {
  if (!body || typeof body !== 'string') return [];

  const lines = body.split(/\r?\n/);
  const citations: ExternalCitation[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-*+]\s*/, '').trim();
    if (!line) continue;

    const markdownLink = line.match(/\[([^\]]+)]\(([^)]+)\)/);
    if (markdownLink) {
      const label = markdownLink[1]?.trim();
      const url = markdownLink[2]?.trim();
      if (url || label) {
        citations.push({ url: url || undefined, label: label || url });
      }
      continue;
    }

    citations.push({ url: line, label: line });
  }

  return citations;
};

const isReadAlsoTitle = (title: string | null | undefined) =>
  READ_ALSO_TITLE_VARIANTS.includes(normalizeTitle(title) ?? '');

const isCitationsTitle = (title: string | null | undefined) =>
  CITATIONS_TITLE_VARIANTS.includes(normalizeTitle(title) ?? '');

export function resolveArticleReferences(
  payload: ArticleDetailResponse | Record<string, unknown>,
  options: ResolveArticleReferencesOptions = {}
) {
  const sections = Array.isArray((payload as ArticleDetailResponse)?.article?.sections)
    ? (payload as ArticleDetailResponse).article.sections
    : [];

  const consumedSectionIndexes = new Set<number>();

  const citationSources: Array<{ value: ArrayLikeValue<unknown>; label: string }> = [
    { value: (payload as { post?: { citations?: unknown } })?.post?.citations, label: 'post.citations' },
    {
      value: (payload as { post?: { article?: { citations?: unknown } } })?.post?.article?.citations,
      label: 'post.article.citations'
    },
    { value: (payload as { article?: { citations?: unknown } })?.article?.citations, label: 'article.citations' },
    { value: (payload as { citations?: unknown })?.citations, label: 'citations' },
    { value: (payload as { article?: { sources?: unknown } })?.article?.sources, label: 'article.sources' },
    { value: (payload as { sources?: unknown })?.sources, label: 'sources' }
  ];

  let externalCitations: ExternalCitation[] = [];
  let citationSourceUsed: string | null = null;

  for (const source of citationSources) {
    const normalized = toArray(source.value)
      .map((entry) => normalizeCitation(entry))
      .filter((entry): entry is ExternalCitation => Boolean(entry));

    if (normalized.length > 0) {
      externalCitations = normalized;
      citationSourceUsed = source.label;
      break;
    }
  }

  if (externalCitations.length === 0 && sections.length > 0) {
    sections.forEach((section, index) => {
      if (!isCitationsTitle(section.title)) {
        return;
      }

      const parsed = parseCitationsFromSection(section.body);
      if (parsed.length > 0) {
        externalCitations.push(...parsed);
        consumedSectionIndexes.add(index);
        if (!citationSourceUsed) {
          citationSourceUsed = `section[${index}].body`;
        }
      }
    });
  }

  const recommendationSources: Array<{ value: ArrayLikeValue<unknown>; label: string }> = [
    { value: (payload as { recommended_articles?: unknown })?.recommended_articles, label: 'recommended_articles' },
    {
      value: (payload as { article?: { recommended_articles?: unknown } })?.article?.recommended_articles,
      label: 'article.recommended_articles'
    },
    { value: (payload as { recommended?: unknown })?.recommended, label: 'recommended' },
    { value: (payload as { article?: { recommended?: unknown } })?.article?.recommended, label: 'article.recommended' },
    { value: (payload as { read_also?: unknown })?.read_also, label: 'read_also' },
    { value: (payload as { article?: { read_also?: unknown } })?.article?.read_also, label: 'article.read_also' },
    { value: (payload as { post?: { recommended_articles?: unknown } })?.post?.recommended_articles, label: 'post.recommended_articles' },
    { value: (payload as { post?: { related?: unknown } })?.post?.related, label: 'post.related' }
  ];

  let internalRecommendations: InternalRecommendation[] = [];
  let recommendationSourceUsed: string | null = null;

  for (const source of recommendationSources) {
    const normalized = toArray(source.value)
      .map((entry) => normalizeInternalRecommendation(entry))
      .filter((entry): entry is InternalRecommendation => Boolean(entry));

    if (normalized.length > 0) {
      internalRecommendations = normalized;
      recommendationSourceUsed = source.label;
      break;
    }
  }

  if (internalRecommendations.length === 0 && sections.length > 0) {
    sections.forEach((section, index) => {
      if (!isReadAlsoTitle(section.title)) {
        return;
      }

      const readAlsoItems = parseReadAlsoItems(section.body ?? '');
      if (readAlsoItems.length === 0) {
        return;
      }

      const recommendations = readAlsoItems
        .map((item) =>
          normalizeInternalRecommendation({
            slug: item.href,
            title: item.title,
            lead: item.snippet
          })
        )
        .filter((item): item is InternalRecommendation => Boolean(item));

      if (recommendations.length > 0) {
        internalRecommendations.push(...recommendations);
        consumedSectionIndexes.add(index);
        if (!recommendationSourceUsed) {
          recommendationSourceUsed = `section[${index}].body`;
        }
      }
    });
  }

  const uniqueCitations = new Map<string, ExternalCitation>();
  externalCitations.forEach((citation) => {
    const key = `${citation.url ?? ''}|${citation.label ?? ''}`;
    if (!uniqueCitations.has(key)) {
      uniqueCitations.set(key, citation);
    }
  });

  const uniqueRecommendations = new Map<string, InternalRecommendation>();
  internalRecommendations.forEach((recommendation) => {
    const key = recommendation.slug;
    if (!uniqueRecommendations.has(key)) {
      uniqueRecommendations.set(key, recommendation);
    }
  });

  const shouldLog = options.enableDebugLog ?? process.env.NODE_ENV !== 'production';
  if (shouldLog && typeof console !== 'undefined') {
    const details = {
      citationSource: citationSourceUsed ?? 'none',
      recommendationSource: recommendationSourceUsed ?? 'none',
      citationCount: uniqueCitations.size,
      recommendationCount: uniqueRecommendations.size
    };
    // eslint-disable-next-line no-console
    console.info('[article-references]', details);
  }

  return {
    externalCitations: Array.from(uniqueCitations.values()),
    internalRecommendations: Array.from(uniqueRecommendations.values()),
    consumedSectionIndexes
  } as const;
}

