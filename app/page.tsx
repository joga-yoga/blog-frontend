import Link from 'next/link';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type PostSummary = {
  id: string;
  slug: string;
  title: string;
  lead: string | null;
  section: string | null;
  tags: string[] | null;
  createdAt: Date;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long'
  }).format(date);
}

export default async function HomePage() {
  const posts = (await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  })) as unknown as PostSummary[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Najnowsze artykuły</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Bądź na bieżąco z naszymi analizami, komentarzami i inspiracjami.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {posts.map((post: PostSummary) => {
          const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];

          return (
            <article
              key={post.id}
              className="flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="text-sm font-medium uppercase tracking-wide text-gray-500">{post.section ?? 'Ogólne'}</div>
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
                    {tags.slice(0, 4).map((tag: string) => (
                      <li key={tag} className="rounded-full bg-blue-100 px-3 py-1">
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <footer className="mt-6 text-sm text-gray-500">
                Opublikowano {formatDate(post.createdAt)}
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
