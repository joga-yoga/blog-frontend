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

const leadValueSchema = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null as string | null;
});

export const articleSummarySchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    section: sectionValueSchema.default(null),
    lead: leadValueSchema.default(null),
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

export type ArticleFaqItem = {
  question: string;
  answer: string;
};

const faqItemSchema = z
  .object({
    question: z.string().optional(),
    q: z.string().optional(),
    answer: z.string().optional(),
    a: z.string().optional(),
    answer_html: z.string().optional()
  })
  .transform((value) => {
    const question = (value.question ?? value.q ?? '').trim();
    const answer = (value.answer ?? value.a ?? value.answer_html ?? '').trim();

    return { question, answer } satisfies ArticleFaqItem;
  })
  .refine((item) => item.question.length > 0 && item.answer.length > 0, {
    message: 'FAQ item must include question and answer'
  });

const faqListSchema = z
  .union([z.array(faqItemSchema), z.record(faqItemSchema)])
  .default([])
  .transform((value) => {
    const items = Array.isArray(value) ? value : Object.values(value);
    return items.filter((item) => item.question && item.answer);
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
  aeo: z
    .object({
      geo_focus: z.array(z.string()).default([]),
      faq: faqListSchema
    })
    .default({ geo_focus: [], faq: [] }),
  // Backwards/forwards compatibility: FAQ may come from a dedicated column instead of payload.aeo
  faq: faqListSchema.optional()
}).transform((value) => {
  const normalizedFaq = value.faq && value.faq.length > 0 ? value.faq : value.aeo.faq;

  return {
    ...value,
    aeo: {
      ...value.aeo,
      faq: normalizedFaq ?? []
    }
  };
});

type ArticleDocumentSchema = z.infer<typeof articleDocumentSchema>;

type ArticleBody = ArticleDocumentSchema['article'] & {
  citations: ArticleCitation[];
};

export type ArticleDocument = Omit<ArticleDocumentSchema, 'article'> & {
  article: ArticleBody;
};

export const articleDetailResponseSchema = articleDocumentSchema.extend({
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

type ArticleDetailResponseSchema = z.infer<typeof articleDetailResponseSchema>;

export type ArticleDetailResponse = Omit<ArticleDetailResponseSchema, 'article'> & {
  article: ArticleBody;
};

const nullableTrimmedString = (maxLength?: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null) {
        return null;
      }

      if (typeof value !== 'string') {
        return undefined as string | null | undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((value) => {
      if (typeof maxLength !== 'number' || value === undefined || value === null) {
        return true;
      }

      return value.length <= maxLength;
    }, `String must contain at most ${maxLength ?? 0} character(s)`);

export const articleCreateRequestSchema = z.object({
  topic: z.string().min(5).max(200),
  rubric_code: nullableTrimmedString(),
  keywords: z.array(z.string()).max(6),
  guidance: nullableTrimmedString(500),
  video_url: nullableTrimmedString(2048)
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
