import { parseReadAlsoItems } from '@/components/ReadAlsoSection';
import type { ArticleDetailResponse } from '@/lib/api/types';

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
    if ('items' in value && Array.isArray((value as { items?: T[] }).items)) {
      return (value as { items: T[] }).items;
    }

    if ('data' in value && Array.isArray((value as { data?: unknown }).data)) {
      return (value as { data: T[] }).data;
    }
  }

  return [];
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

const isReadAlsoTitle = (title: string | null | undefined) =>
  READ_ALSO_TITLE_VARIANTS.includes(normalizeTitle(title) ?? '');

export function resolveArticleReferences(
  payload: ArticleDetailResponse | Record<string, unknown>,
  options: ResolveArticleReferencesOptions = {}
) {
  const sections = Array.isArray((payload as ArticleDetailResponse)?.article?.sections)
    ? (payload as ArticleDetailResponse).article.sections
    : [];

  const consumedSectionIndexes = new Set<number>();

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
    { value: (payload as { post?: { related?: unknown } })?.post?.related, label: 'post.related' },
    { value: (payload as { payload?: { recommended_articles?: unknown } })?.payload?.recommended_articles, label: 'payload.recommended_articles' },
    {
      value: (payload as { payload?: { article?: { recommended_articles?: unknown } } })?.payload?.article?.recommended_articles,
      label: 'payload.article.recommended_articles'
    },
    { value: (payload as { payload?: { related?: unknown } } )?.payload?.related, label: 'payload.related' },
    { value: (payload as { payload?: { internal_links?: unknown } })?.payload?.internal_links, label: 'payload.internal_links' },
    { value: (payload as { post?: { payload?: { related?: unknown } } })?.post?.payload?.related, label: 'post.payload.related' },
    {
      value: (payload as { post?: { payload?: { internal_links?: unknown } } })?.post?.payload?.internal_links,
      label: 'post.payload.internal_links'
    },
    {
      value: (payload as { post?: { payload?: { article?: { recommended_articles?: unknown } } } })?.post?.payload?.article
        ?.recommended_articles,
      label: 'post.payload.article.recommended_articles'
    }
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
      recommendationSource: recommendationSourceUsed ?? 'none',
      recommendationCount: uniqueRecommendations.size
    };
    // eslint-disable-next-line no-console
    console.info('[article-references]', details);
  }

  return {
    internalRecommendations: Array.from(uniqueRecommendations.values()),
    consumedSectionIndexes
  } as const;
}

