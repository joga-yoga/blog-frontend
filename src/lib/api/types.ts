import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.string(),
  db: z.string().optional().default('unknown'),
  driver: z.string().optional().default('unknown'),
  database_url_present: z.boolean().optional().default(false)
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

const tagsValueSchema = z
  .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (Array.isArray(value)) {
      return value.map((tag) => tag.trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((tag) => String(tag).trim()).filter(Boolean);
        }
      } catch {
        // treat as comma separated string
      }

      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    return [] as string[];
  });

const sectionValueSchema = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null as string | null;
});

export const articleSummarySchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    section: sectionValueSchema.default(null),
    tags: tagsValueSchema.default([]),
    created_at: z.string(),
    updated_at: z.string()
  })
  .transform((item) => ({
    ...item,
    tags: item.tags ?? []
  }));

export type ArticleSummary = z.infer<typeof articleSummarySchema>;

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type ArticleListResponse = Paged<ArticleSummary>;

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

const emptyPaged: Paged<never> = {
  items: [],
  total: 0,
  page: 1,
  page_size: 0,
  total_pages: 0
};

export function toPaged<T>(
  data: unknown,
  itemSchema: z.ZodType<T>,
  options: { resourceName?: string } = {}
): Paged<T> {
  const resourceName = options.resourceName ?? 'items';
  const parseItems = (value: unknown): T[] => {
    if (value === undefined) {
      return [];
    }

    const result = z.array(itemSchema).safeParse(value);

    if (!result.success) {
      console.warn(
        `Failed to parse ${resourceName} array from API response. Returning an empty list instead.`,
        result.error.flatten()
      );
      return [];
    }

    return result.data;
  };

  const resolveFromItems = (itemsSource: unknown, metaSource: Record<string, unknown> | undefined) => {
    const items = parseItems(itemsSource);
    const total =
      coerceNumber(metaSource?.total) ??
      coerceNumber(metaSource?.total_items) ??
      items.length;
    const resolvedPageSize =
      coerceNumber(metaSource?.page_size) ??
      coerceNumber(metaSource?.per_page) ??
      (items.length > 0 ? items.length : 0) ??
      0;
    const totalPages =
      coerceNumber(metaSource?.total_pages) ??
      (resolvedPageSize > 0 ? Math.max(1, Math.ceil(total / resolvedPageSize)) : total > 0 ? 1 : 0);

    return { items, total, pageSize: resolvedPageSize ?? 0, totalPages };
  };

  if (Array.isArray(data)) {
    const { items, total, pageSize, totalPages } = resolveFromItems(data, undefined);
    return {
      items,
      total,
      page: 1,
      page_size: pageSize,
      total_pages: totalPages
    } satisfies Paged<T>;
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const meta = typeof record.meta === 'object' && record.meta !== null ? (record.meta as Record<string, unknown>) : undefined;

    const hasItems = Object.prototype.hasOwnProperty.call(record, 'items');
    const hasResults = Object.prototype.hasOwnProperty.call(record, 'results');
    const itemsSource = hasItems
      ? record.items
      : hasResults
        ? (record as Record<string, unknown>).results
        : Array.isArray(record.data)
          ? record.data
          : undefined;

    const { items, total, pageSize, totalPages } = resolveFromItems(itemsSource, {
      ...meta,
      total: record.total ?? meta?.total,
      total_items: record.total_items ?? meta?.total_items,
      page_size: record.page_size ?? meta?.page_size,
      per_page: record.per_page ?? meta?.per_page,
      total_pages: record.total_pages ?? meta?.total_pages
    });

    const page =
      coerceNumber(record.page) ??
      coerceNumber(record.current_page) ??
      coerceNumber(meta?.page) ??
      1;

    const resolvedPageSize =
      coerceNumber(record.page_size) ??
      coerceNumber(record.per_page) ??
      coerceNumber(meta?.page_size) ??
      coerceNumber(meta?.per_page) ??
      pageSize;

    const resolvedTotal =
      coerceNumber(record.total) ??
      coerceNumber(record.total_items) ??
      coerceNumber(meta?.total) ??
      coerceNumber(meta?.total_items) ??
      total;

    const resolvedTotalPages =
      coerceNumber(record.total_pages) ??
      coerceNumber(meta?.total_pages) ??
      (resolvedPageSize && resolvedPageSize > 0
        ? Math.max(1, Math.ceil(resolvedTotal / resolvedPageSize))
        : resolvedTotal > 0
          ? 1
          : 0);

    return {
      items,
      total: resolvedTotal,
      page,
      page_size: resolvedPageSize ?? 0,
      total_pages: resolvedTotalPages
    } satisfies Paged<T>;
  }

  console.warn('Unexpected paged API response shape. Returning an empty result.', data);

  return {
    ...emptyPaged,
    items: [] as T[]
  };
}

export function parseArticleListResponse(data: unknown): ArticleListResponse {
  return toPaged(data, articleSummarySchema, { resourceName: 'articles' });
}

const taxonomySchema = z.object({
  section: z.string(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
});

export type ArticleCitation = {
  url?: string;
  label: string;
};

const citationValueSchema = z
  .union([
    z.string(),
    z.object({
      url: z.string().optional(),
      title: z.string().optional(),
      label: z.string().optional(),
      description: z.string().optional()
    })
  ])
  .transform((value) => {
    if (typeof value === 'string') {
      return {
        url: value,
        label: value
      } satisfies ArticleCitation;
    }

    const label = value.title ?? value.label ?? value.description ?? value.url ?? '';

    return {
      url: value.url,
      label: label || (value.url ?? '')
    } satisfies ArticleCitation;
  });

const faqItemSchema = z.object({
  question: z.string(),
  answer: z.string()
});

const articleSectionSchema = z.object({
  title: z.string(),
  body: z.string()
});

export const articleDocumentSchema = z.object({
  topic: z.string(),
  slug: z.string(),
  locale: z.string().default('pl-PL'),
  taxonomy: taxonomySchema,
  seo: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    canonical: z.string().optional(),
    robots: z.string().optional()
  }),
  article: z.object({
    headline: z.string(),
    lead: z.string(),
    sections: z.array(articleSectionSchema).min(1),
    citations: z.array(citationValueSchema).default([])
  }),
  aeo: z.object({
    geo_focus: z.array(z.string()).default([]),
    faq: z.array(faqItemSchema).default([])
  })
});

type ArticleDocumentSchema = z.infer<typeof articleDocumentSchema>;

type ArticleBody = ArticleDocumentSchema['article'] & {
  citations: ArticleCitation[];
};

export type ArticleDocument = Omit<ArticleDocumentSchema, 'article'> & {
  article: ArticleBody;
};

export type ArticleFaqItem = z.infer<typeof faqItemSchema>;

export const articleDetailResponseSchema = articleDocumentSchema.extend({
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

type ArticleDetailResponseSchema = z.infer<typeof articleDetailResponseSchema>;

export type ArticleDetailResponse = Omit<ArticleDetailResponseSchema, 'article'> & {
  article: ArticleBody;
};

export const articleCreateRequestSchema = z.object({
  topic: z.string().min(5).max(200),
  rubric_code: z.string().optional(),
  keywords: z.array(z.string()).max(6),
  guidance: z.string().max(500).optional()
});

export type ArticleCreateRequest = z.infer<typeof articleCreateRequestSchema>;

export const articlePublishResponseSchema = z.object({
  status: z.literal('published'),
  slug: z.string(),
  id: z.union([z.string(), z.number()]),
  post: articleDetailResponseSchema.optional()
});

type ArticlePublishResponseSchema = z.infer<typeof articlePublishResponseSchema>;

export type ArticlePublishResponse = Omit<ArticlePublishResponseSchema, 'post'> & {
  post?: ArticleDetailResponse;
};

export const rubricSchema = z.object({
  code: z.string(),
  name_pl: z.string(),
  is_active: z.boolean()
});

export type Rubric = z.infer<typeof rubricSchema>;

export const rubricsResponseSchema = z.array(rubricSchema);

export const articleSchemaResponseSchema = z.record(z.any());

export type ArticleSchemaResponse = z.infer<typeof articleSchemaResponseSchema>;

export type ArticleListQuery = {
  page?: number;
  per_page?: number;
  section?: string;
  q?: string;
};
