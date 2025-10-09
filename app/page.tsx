import Link from 'next/link';
import { getArticles, getHealth, ServiceUnavailableError, type ApiError } from '@/lib/api/client';
import type { ArticleListResponse } from '@/lib/api/types';

export const revalidate = 300;

const ARTICLES_PER_PAGE = 10;

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

type QueryState = {
  page: number;
  section?: string;
  q?: string;
};

function parseQuery(searchParams: SearchParams): QueryState {
  const params = searchParams ?? {};
  const pageValue = params.page;
  const sectionValue = params.section;
  const searchValue = params.q;

  const page = Array.isArray(pageValue) ? pageValue[0] : pageValue;
  const section = Array.isArray(sectionValue) ? sectionValue[0] : sectionValue;
  const q = Array.isArray(searchValue) ? searchValue[0] : searchValue;

  const parsedPage = Number.parseInt(page ?? '1', 10);

  return {
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    section: section?.trim() || undefined,
    q: q?.trim() || undefined
  } satisfies QueryState;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' }).format(date);
}

function buildQueryString(query: QueryState, overrides: Partial<QueryState>): string {
  const params = new URLSearchParams();
  const next = { ...query, ...overrides };

  if (next.page > 1) {
    params.set('page', String(next.page));
  }

  if (next.section) {
    params.set('section', next.section);
  }

  if (next.q) {
    params.set('q', next.q);
  }

  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

function SectionFilter({
  query,
  articles
}: {
  query: QueryState;
  articles: ArticleListResponse | null;
}) {
  const sections = new Set<string>();

  if (articles) {
    for (const item of articles.items) {
      if (item.section) {
        sections.add(item.section);
      }
    }
  }

  const options = Array.from(sections).sort((a, b) => a.localeCompare(b, 'pl'));

  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex flex-1 flex-col gap-1 text-sm text-gray-700 sm:max-w-xs">
        <span className="font-medium">Sekcja</span>
        <select
          name="section"
          defaultValue={query.section ?? ''}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Wszystkie sekcje</option>
          {options.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-1 flex-col gap-1 text-sm text-gray-700 sm:max-w-sm">
        <span className="font-medium">Wyszukaj</span>
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ''}
          placeholder="Słowa kluczowe lub tagi"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </label>

      <div className="flex items-end">
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Zastosuj
        </button>
      </div>
    </div>
  );
}

function Pagination({ query, articles }: { query: QueryState; articles: ArticleListResponse }) {
  const { page, total_pages: totalPages, total } = articles;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center justify-between gap-4 border-t border-gray-200 pt-6 text-sm text-gray-600" aria-label="Paginacja">
      <div>
        Strona {page} z {totalPages} • {total} artykułów
      </div>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={buildQueryString(query, { page: page - 1 })}
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Poprzednia
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={buildQueryString(query, { page: page + 1 })}
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Następna
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function ArticleList({ articles, query }: { articles: ArticleListResponse; query: QueryState }) {
  const items = articles.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
        Brak artykułów spełniających wybrane kryteria.
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {items.map((post) => (
        <article
          key={post.slug}
          className="flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <div className="space-y-3">
            <div className="text-sm font-medium uppercase tracking-wide text-gray-500">{post.section ?? 'Ogólne'}</div>
            <h2 className="text-2xl font-semibold text-slate-900">
              <Link href={`/artykuly/${post.slug}`} className="hover:underline">
                {post.title}
              </Link>
            </h2>
            <p className="line-clamp-3 text-base text-gray-600">
              {post.updated_at ? `Zaktualizowano ${formatDate(post.updated_at)}` : `Opublikowano ${formatDate(post.created_at)}`}
            </p>
            {post.tags.length > 0 ? (
              <ul className="flex flex-wrap gap-2 text-sm text-blue-700">
                {post.tags.slice(0, 6).map((tag) => (
                  <li key={`${post.slug}-${tag}`} className="rounded-full bg-blue-100 px-3 py-1">
                    <Link href={buildQueryString(query, { page: 1, q: tag })}>#{tag}</Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <footer className="mt-6 text-sm text-gray-500">Opublikowano {formatDate(post.created_at)}</footer>
        </article>
      ))}
    </div>
  );
}

function ArticlesFallback({ error }: { error: ApiError }) {
  const isUnavailable = error instanceof ServiceUnavailableError || error.status === 502 || error.status === 503;

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-600">
      {isUnavailable ? (
        <>
          <p className="font-semibold text-slate-900">Serwis chwilowo niedostępny</p>
          <p className="mt-2 text-sm">Spróbuj ponownie za kilka minut. Nasze API jest w trakcie aktualizacji.</p>
        </>
      ) : (
        <>
          <p className="font-semibold text-slate-900">Nie udało się pobrać artykułów</p>
          <p className="mt-2 text-sm">Odśwież stronę lub spróbuj ponownie później.</p>
        </>
      )}
    </div>
  );
}

function HealthNotice({ healthy }: { healthy: boolean }) {
  if (healthy) {
    return null;
  }

  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
      Trwają prace serwisowe w backendzie. Niektóre funkcje mogą działać wolniej niż zwykle.
    </div>
  );
}

export default async function HomePage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = parseQuery(resolvedSearchParams);

  const [articlesResult, healthResult] = await Promise.allSettled([
    getArticles({
      page: query.page,
      per_page: ARTICLES_PER_PAGE,
      section: query.section,
      q: query.q
    }, { revalidate }),
    getHealth({ revalidate: 120 })
  ]);

  const articles = articlesResult.status === 'fulfilled' ? articlesResult.value : null;
  const articlesError = articlesResult.status === 'rejected' ? (articlesResult.reason as ApiError) : null;
  const health = healthResult.status === 'fulfilled' ? healthResult.value : null;
  const isHealthy = health ? health.status === 'ok' && health.db === 'ok' : false;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Najnowsze artykuły</h1>
        <p className="max-w-2xl text-gray-600">
          Bądź na bieżąco z naszymi analizami, komentarzami i inspiracjami. Skorzystaj z filtrów, aby znaleźć interesującą Cię sekcję lub temat.
        </p>
        <HealthNotice healthy={isHealthy} />
      </div>

      <form className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" role="search">
        <SectionFilter query={query} articles={articles} />
      </form>

      {articles ? (
        <div className="space-y-8">
          <ArticleList articles={articles} query={query} />
          <Pagination query={query} articles={articles} />
        </div>
      ) : articlesError ? (
        <ArticlesFallback error={articlesError} />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">Ładowanie danych…</div>
      )}
    </div>
  );
}
