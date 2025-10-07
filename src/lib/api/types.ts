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

export const paginationMetaSchema = z.object({
  page: z.number(),
  per_page: z.number(),
  total_items: z.number(),
  total_pages: z.number()
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export const articleListResponseSchema = z.object({
  meta: paginationMetaSchema,
  items: z.array(articleSummarySchema)
});

export type ArticleListResponse = z.infer<typeof articleListResponseSchema>;

const taxonomySchema = z.object({
  section: z.string(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
});

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

export type ArticleDocument = z.infer<typeof articleDocumentSchema> & {
  article: {
    citations: ArticleCitation[];
  } & ArticleDocument['article'];
};

export type ArticleCitation = {
  url?: string;
  label: string;
};

export type ArticleFaqItem = z.infer<typeof faqItemSchema>;

export const articleDetailResponseSchema = articleDocumentSchema.extend({
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export type ArticleDetailResponse = z.infer<typeof articleDetailResponseSchema> & {
  article: ArticleDocument['article'];
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

export type ArticlePublishResponse = z.infer<typeof articlePublishResponseSchema>;

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
