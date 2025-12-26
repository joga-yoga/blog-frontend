import type { ArticleCitation } from '@/lib/api/types';

type ArrayLikeValue<T> = T | T[] | { data?: T[]; items?: T[] } | null | undefined;

type ExtractedCitation = { url: string; label: string };

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

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

export function extractExternalCitations(payload: unknown): { externalCitations: ExtractedCitation[] } {
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

  const uniqueByUrl = new Map<string, ExtractedCitation>();

  collected.forEach((entry) => {
    if (!entry) return;
    if (!isHttpUrl(entry.url)) return;

    const normalizedUrl = entry.url.trim();
    if (!uniqueByUrl.has(normalizedUrl)) {
      const label = entry.label?.trim();
      if (label && label.length > 0 && label !== normalizedUrl) {
        uniqueByUrl.set(normalizedUrl, { url: normalizedUrl, label });
        return;
      }

      try {
        const hostname = new URL(normalizedUrl).hostname;
        uniqueByUrl.set(normalizedUrl, { url: normalizedUrl, label: hostname });
      } catch {
        uniqueByUrl.set(normalizedUrl, { url: normalizedUrl, label: normalizedUrl });
      }
    }
  });

  return { externalCitations: Array.from(uniqueByUrl.values()) };
}
