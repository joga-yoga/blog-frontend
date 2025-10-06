// app/page.tsx
// Минимальная версия: без Prisma, без лишних проверок.
// Берём данные с backend API через NEXT_PUBLIC_BACKEND_URL.

import Link from 'next/link';

export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wiedza.joga.yoga';

function buildApiUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

type PostSummary = {
  id: string | number;
  slug: string;
  title: string;
  lead?: string | null;
  section?: string | null;
  tags?: string[] | string | null;
  created_at: string; // ISO
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' }).format(date);
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed as string[];
    } catch {}
  }
  return [];
}

function toPostSummaries(payload: unknown): PostSummary[] {
  if (Array.isArray(payload)) {
    return payload.filter(isPostSummary);
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const preferredKeys = ['items', 'posts', 'data', 'results'];

    for (const key of preferredKeys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value.filter(isPostSummary);
      }
    }

    for (const value of Object.values(record)) {
      if (Array.isArray(value)) {
        return value.filter(isPostSummary);
      }
    }
  }

  return [];
}

function isPostSummary(value: unknown): value is PostSummary {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;

  return (
    (typeof candidate.id === 'string' || typeof candidate.id === 'number') &&
    typeof candidate.slug === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.created_at === 'string'
  );
}

export default async function HomePage() {
  const apiUrl = buildApiUrl('/api/posts?limit=20');
  const res = await fetch(apiUrl, {
    next: { revalidate: 60 }
  });

  if (!res.ok) {
    throw new Error(`Nie udało się pobrać artykułów: ${res.status}`);
  }

  const payload = await res.json();
  const postsData = toPostSummaries(payload) as unknown;
  const posts = Array.isArray(postsData) ? (postsData as PostSummary[]) : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Najnowsze artykuły</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Bądź na bieżąco z naszymi analizami, komentarzami i inspiracjami.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {posts.map((post) => {
          const tags = normalizeTags(post.tags);
          return (
            <article
              key={post.id}
              className="flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="text-sm font-medium uppercase tracking-wide text-gray-500">
                  {post.section ?? 'Ogólne'}
                </div>

                <h2 className="text-2xl font-semibold text-slate-900">
                  <Link href={`/artykuly/${post.slug}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>

                {post.lead ? (
                  <p className="line-clamp-3 text-base text-gray-600">{post.lead}</p>
                ) : null}

                {tags.length > 0 ? (
                  <ul className="flex flex-wrap gap-2 text-sm text-blue-700">
                    {tags.slice(0, 4).map((tag) => (
                      <li key={tag} className="rounded-full bg-blue-100 px-3 py-1">
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <footer className="mt-6 text-sm text-gray-500">
                Opublikowano {formatDate(post.created_at)}
              </footer>
            </article>
          );
        })}

        {posts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">
            Brak artykułów do wyświetlenia.
          </div>
        ) : null}
      </div>
    </div>
  );
}
