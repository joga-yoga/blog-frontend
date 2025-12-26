import type { ArticleCitation } from '@/lib/api/types';
import type { InternalRecommendation } from '@/lib/article-references';
import { getSiteBaseUrl } from '@/lib/site';

type ArrayLikeValue<T> = T | T[] | { data?: T[]; items?: T[] } | null | undefined;

type ExtractedCitation = { url: string; label: string };

type ExtractCitationsResult = {
  externalCitations: ExtractedCitation[];
  internalRecommendations: InternalRecommendation[];
};

const toArray = <T>(value: ArrayLikeValue<T>): T[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    if (Array.isArray((value as { items?: T[] }).items)) {
      return (value as { items: T[] }).items;
    }

    if (Array.isArray((value as { data?: T[] }).data)) {
      return (value as { data: T[] }).data;
    }
  }

  return [];
};

const normalizeCitation = (entry: unknown): ExtractedCitation | null => {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const url = entry.trim();
    if (!url) return null;
    return { url, label: url } satisfies ExtractedCitation;
  }

  if (typeof entry === 'object') {
    const value = entry as ArticleCitation & { href?: string; title?: string; name?: string; description?: string };
    const rawUrl = value.url ?? value.href;
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    const labelCandidate = value.label ?? value.title ?? value.name ?? value.description ?? url;
    const label = typeof labelCandidate === 'string' && labelCandidate.trim() ? labelCandidate.trim() : url;

    if (!url) {
      return null;
    }

    return { url, label } satisfies ExtractedCitation;
  }

  return null;
};

const resolveInternalSlug = (value: string): string | null => {
  try {
    const base = getSiteBaseUrl();
    const parsed = new URL(value, base);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const slug = segments.pop();
    return slug ?? null;
  } catch {
    return null;
  }
};

const isHttpUrl = (value: string): boolean => /^https?:/i.test(value);

export function extractExternalCitations(payload: unknown): ExtractCitationsResult {
  const candidates: Array<ArrayLikeValue<unknown>> = [
    (payload as { citations?: unknown })?.citations,
    (payload as { article?: { citations?: unknown } })?.article?.citations,
    (payload as { post?: { citations?: unknown } })?.post?.citations,
    (payload as { payload?: { citations?: unknown } })?.payload?.citations,
    (payload as { payload?: { article?: { citations?: unknown } } })?.payload?.article?.citations,
    (payload as { post?: { payload?: { citations?: unknown } } })?.post?.payload?.citations,
    (payload as { post?: { payload?: { article?: { citations?: unknown } } } })?.post?.payload?.article?.citations
  ];

  const collected = candidates.flatMap((value) => toArray(value).map((entry) => normalizeCitation(entry))).filter(Boolean);

  const siteHostname = (() => {
    try {
      return new URL(getSiteBaseUrl()).hostname;
    } catch {
      return null;
    }
  })();

  const externalByUrl = new Map<string, ExtractedCitation>();
  const internalBySlug = new Map<string, InternalRecommendation>();

  collected.forEach((entry) => {
    if (!entry) return;

    const normalizedUrl = entry.url.trim();
    const label = entry.label?.trim();

    if (!normalizedUrl) return;

    const slug = resolveInternalSlug(normalizedUrl);
    const parsedHostname = (() => {
      try {
        return new URL(normalizedUrl, getSiteBaseUrl()).hostname;
      } catch {
        return null;
      }
    })();

    const isInternal = slug && siteHostname && parsedHostname === siteHostname;

    if (isInternal && slug) {
      if (!internalBySlug.has(slug)) {
        internalBySlug.set(slug, {
          slug,
          title: label && label.length > 0 ? label : slug,
          lead: undefined,
          section: undefined
        });
      }
      return;
    }

    if (!isHttpUrl(normalizedUrl)) return;

    if (!externalByUrl.has(normalizedUrl)) {
      if (label && label.length > 0 && label !== normalizedUrl) {
        externalByUrl.set(normalizedUrl, { url: normalizedUrl, label });
        return;
      }

      try {
        const hostname = new URL(normalizedUrl).hostname;
        externalByUrl.set(normalizedUrl, { url: normalizedUrl, label: hostname });
      } catch {
        externalByUrl.set(normalizedUrl, { url: normalizedUrl, label: normalizedUrl });
      }
    }
  });

  return {
    externalCitations: Array.from(externalByUrl.values()),
    internalRecommendations: Array.from(internalBySlug.values())
  };
}
