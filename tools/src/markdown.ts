import type { ArticleFaqItem, ArticlePayload, ArticleSection } from './types';

const FRONTMATTER_BASE_URL = 'https://wiedza.joga.yoga/artykuly';

const DEFAULT_ROBOTS = 'index,follow';

const NEWLINE = '\n';

export const normalizeNewlines = (value: string): string => value.replace(/\r\n/g, NEWLINE).replace(/\r/g, NEWLINE);

export const ensureTrailingNewline = (value: string): string => (value.endsWith(NEWLINE) ? value : `${value}${NEWLINE}`);

export const escapeYamlString = (value: string): string => value.replace(/"/g, '\\"');

const stringifyArray = (input: string[] | undefined): string => JSON.stringify(input ?? []);

const formatSection = (section: ArticleSection): string => {
  const title = section.title.trim();
  const body = normalizeNewlines(section.body.trim());
  return [`## ${title}`, body, ''].join(NEWLINE);
};

const formatFaqEntry = (faq: ArticleFaqItem): string => {
  const question = normalizeNewlines(faq.question.trim());
  const answer = normalizeNewlines(faq.answer.trim());
  return [`**${question}**  `, answer, ''].join(NEWLINE);
};

const formatFaqBlock = (faqItems: ArticleFaqItem[] | undefined): string => {
  if (!faqItems || faqItems.length === 0) {
    return '';
  }

  const entries = faqItems.map(formatFaqEntry).join(NEWLINE).trimEnd();
  return [`## FAQ`, entries].join(NEWLINE);
};

const formatCitations = (citations: string[] | undefined): string => {
  if (!citations || citations.length === 0) {
    return '## Źródła / Citations';
  }

  const lines = citations.map((citation) => `- ${normalizeNewlines(citation.trim())}`).join(NEWLINE);
  return [`## Źródła / Citations`, lines].join(NEWLINE);
};

export interface PersistedDates {
  datePublished?: string;
  dateModified?: string;
}

export const extractPersistedDates = (content: string): PersistedDates => {
  const normalized = normalizeNewlines(content);
  const datePublishedMatch = normalized.match(/datePublished:\s+\"([^\"]*)\"/);
  const dateModifiedMatch = normalized.match(/dateModified:\s+\"([^\"]*)\"/);
  return {
    datePublished: datePublishedMatch ? datePublishedMatch[1] : undefined,
    dateModified: dateModifiedMatch ? dateModifiedMatch[1] : undefined
  };
};

export const buildMarkdown = (payload: ArticlePayload, generatedAt: Date, persistedDates?: PersistedDates): string => {
  const slug = payload.seo.slug;
  const canonical = payload.seo.canonical ?? `${FRONTMATTER_BASE_URL}/${slug}`;
  const robots = payload.seo.robots?.trim() || DEFAULT_ROBOTS;
  const categories = stringifyArray(payload.taxonomy.categories);
  const tags = stringifyArray(payload.taxonomy.tags);
  const geoFocus = stringifyArray(payload.aeo.geo_focus);
  const datePublished = payload.article.datePublished
    ?? persistedDates?.datePublished
    ?? generatedAt.toISOString();
  const dateModified = payload.article.dateModified
    ?? persistedDates?.dateModified
    ?? generatedAt.toISOString();

  const frontMatter = [
    '---',
    `title: "${escapeYamlString(payload.seo.title)}"`,
    `description: "${escapeYamlString(payload.seo.description)}"`,
    `canonical: "${escapeYamlString(canonical)}"`,
    `slug: "${escapeYamlString(slug)}"`,
    'locale: "pl-PL"',
    `robots: "${escapeYamlString(robots)}"`,
    `section: "${escapeYamlString(payload.taxonomy.section)}"`,
    `categories: ${categories}`,
    `tags: ${tags}`,
    `geo_focus: ${geoFocus}`,
    `datePublished: "${escapeYamlString(datePublished)}"`,
    `dateModified: "${escapeYamlString(dateModified)}"`,
    '---',
    ''
  ].join(NEWLINE);

  const sectionBlocks = payload.article.sections.map(formatSection).join(NEWLINE).trimEnd();
  const faqBlock = formatFaqBlock(payload.aeo.faq);
  const citationsBlock = formatCitations(payload.article.citations);

  const parts: Array<string | null> = [
    frontMatter,
    '# TL;DR',
    normalizeNewlines(payload.article.lead.trim()),
    '',
    `# ${payload.article.headline.trim()}`,
    sectionBlocks,
    '',
    faqBlock || null,
    faqBlock ? '' : null,
    citationsBlock,
    ''
  ];

  const markdown = parts.filter((part): part is string => part !== null).join(NEWLINE);
  return ensureTrailingNewline(markdown);
};
