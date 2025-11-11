import { z } from 'zod';

const faqItemSchema = z.object({
  question: z.string().min(1, 'FAQ question is required'),
  answer: z.string().min(1, 'FAQ answer is required')
});

const sectionSchema = z.object({
  title: z.string().min(1, 'Section title is required'),
  body: z.string().min(1, 'Section body is required')
});

const articleSchema = z.object({
  lead: z.string().min(1, 'Article lead is required'),
  headline: z.string().min(1, 'Article headline is required'),
  sections: z.array(sectionSchema).nonempty('At least one section is required'),
  citations: z.array(z.string().min(1)).optional(),
  datePublished: z.string().optional(),
  dateModified: z.string().optional()
});

const seoSchema = z.object({
  title: z.string().min(1, 'SEO title is required'),
  description: z.string().min(1, 'SEO description is required'),
  canonical: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain lowercase letters, numbers, or dashes'),
  robots: z.string().optional()
});

const taxonomySchema = z.object({
  section: z.string().min(1, 'Section is required'),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional()
});

const aeoSchema = z.object({
  geo_focus: z.array(z.string()).optional(),
  faq: z.array(faqItemSchema).optional()
});

export const articlePayloadSchema = z.object({
  seo: seoSchema,
  taxonomy: taxonomySchema,
  aeo: aeoSchema,
  article: articleSchema
});

export type ArticlePayload = z.infer<typeof articlePayloadSchema>;
export type ArticleSection = z.infer<typeof sectionSchema>;
export type ArticleFaqItem = z.infer<typeof faqItemSchema>;
