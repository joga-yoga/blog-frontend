import Link from 'next/link';
import prisma from '@/lib/prisma';
import type { PostSummary } from '@/types/content';

export const dynamic = 'force-dynamic';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long'
  }).format(date);
}

function parseTags(raw: unknown): string[] | null {
  if (Array.isArray(raw) && raw.every((item) => typeof item === 'string')) {
    return raw as string[];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return parsed as string[];
      }
    } catch {
      return null;
    }
  }

  return null;
}

export default async function HomePage() {
  const rawPosts = await prisma.$queryRaw<Array<Omit<PostSummary, 'tags'> & { tags: unknown }>>`
    SELECT id, slug, title, lead, section, tags, created_at
    FROM posts
    ORDER BY created_at DESC
    LIMIT 20
  `;

  const posts: PostSummary[] = rawPosts.map((post) => ({
    ...post,
    tags: parseTags(post.tags)
  }));

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
          const tags = Array.isArray(post.tags) ? post.tags : [];

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
