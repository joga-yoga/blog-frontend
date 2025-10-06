export type PostSummary = {
  id: number;
  slug: string;
  title: string;
  lead: string | null;
  section: string | null;
  tags: string[] | null;
  created_at: string;
};

export type PostFull = PostSummary & {
  description: string | null;
  body_mdx: string;
  faq: Array<{ q: string; a: string }> | null;
  citations: Array<{ url: string; title?: string; date?: string }> | null;
  locale: string;
};
