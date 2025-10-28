import Link from 'next/link';
import type { Metadata } from 'next';
import { getArticles } from '@/lib/api/client';
import type { ArticleListResponse } from '@/lib/api/types';
import { buildCanonicalUrl } from '@/lib/site';

export const revalidate = 60;

const ARTICLES_PER_PAGE = 12;

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

type QueryState = {
  page: number;
};

function parseQuery(searchParams: SearchParams | undefined): QueryState {
  const pageValue = searchParams?.page;
  const page = Array.isArray(pageValue) ? pageValue[0] : pageValue;
  const parsed = Number.parseInt(page ?? '1', 10);

  return {
    page: Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  } satisfies QueryState;
}

function buildPageHref(page: number): string {
  if (page <= 1) {
    return '/artykuly';
  }
  const params = new URLSearchParams();
  params.set('page', String(page));
  return `/artykuly?${params.toString()}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' }).format(date);
}

function Pagination({ meta }: ArticleListResponse) {
  if (meta.total_pages <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center justify-between gap-4 border-t border-gray-200 pt-6 text-sm text-gray-600" aria-label="Paginacja">
      <span>
        Strona {meta.page} z {meta.total_pages}
      </span>
      <div className="flex items-center gap-2">
        {meta.page > 1 ? (
          <Link
            href={buildPageHref(meta.page - 1)}
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Poprzednia
          </Link>
        ) : null}
        {meta.page < meta.total_pages ? (
          <Link
            href={buildPageHref(meta.page + 1)}
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Następna
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export async function generateMetadata({ searchParams }: { searchParams?: PageProps['searchParams'] }): Promise<Metadata> {
  const resolved = (await searchParams) ?? {};
  const { page } = parseQuery(resolved);
  const canonicalUrl = buildCanonicalUrl(
    '/artykuly',
    page > 1 ? new URLSearchParams({ page: String(page) }) : null
  );

  return {
    title: page > 1 ? `Artykuły – strona ${page}` : 'Artykuły',
    description:
      'Najświeższe artykuły o jodze, świadomym ruchu i wellbeing w Polsce. Przeglądaj najnowsze publikacje od joga.yoga.',
    alternates: {
      canonical: canonicalUrl
    }
  } satisfies Metadata;
}

export default async function ArticlesIndexPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const { page } = parseQuery(resolved);

  const articles = await getArticles({ page, per_page: ARTICLES_PER_PAGE }, { revalidate });

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Biblioteka artykułów joga.yoga</h1>
        <p className="max-w-2xl text-gray-600">
          Przeglądaj posegregowane artykuły o jodze, oddechu i świadomym stylu życia. Wracaj regularnie po nowe inspiracje.
        </p>
      </header>

      {articles.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          Brak artykułów do wyświetlenia.
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {articles.items.map((item) => (
              <article key={item.slug} className="flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="space-y-3">
                  <div className="text-sm font-medium uppercase tracking-wide text-gray-500">{item.section ?? 'Ogólne'}</div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    <Link href={`/artykuly/${item.slug}`} className="hover:underline">
                      {item.title}
                    </Link>
                  </h2>
                  {item.lead ? <p className="line-clamp-3 text-base text-gray-700">{item.lead}</p> : null}
                  <p className="text-sm text-gray-500">Zaktualizowano {formatDate(item.updated_at)}</p>
                </div>
                <footer className="mt-6 text-sm text-gray-500">Opublikowano {formatDate(item.created_at)}</footer>
              </article>
            ))}
          </div>
          <Pagination {...articles} />
        </div>
      )}
    </div>
  );
}
