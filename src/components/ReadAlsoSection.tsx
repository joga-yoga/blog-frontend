import Link from 'next/link';

export type ReadAlsoItem = {
  title: string;
  href: string;
  snippet: string;
};

type ReadAlsoSectionProps = {
  items: ReadAlsoItem[];
  heading?: string;
};

const READ_ALSO_HEADING_ID = 'read-also-heading';

export function ReadAlsoSection({ items, heading = 'Przeczytaj również' }: ReadAlsoSectionProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={READ_ALSO_HEADING_ID} className="space-y-4">
      <h2 id={READ_ALSO_HEADING_ID} className="text-2xl font-semibold text-slate-900">
        {heading}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item, index) => {
          const key = item.href?.length ? item.href : `item-${index}`;
          return (
            <article
              key={key}
              className="rounded-2xl border bg-white/60 p-5 shadow-sm transition hover:shadow"
            >
              <h3 className="text-lg font-semibold leading-snug">
                <Link href={item.href} className="hover:underline">
                  {item.title}
                </Link>
              </h3>
              {item.snippet ? (
                <p className="mt-2 text-sm text-slate-700 line-clamp-2">{item.snippet}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function parseReadAlsoItems(body: string): ReadAlsoItem[] {
  if (!body || typeof body !== 'string') {
    return [];
  }

  const lines = body.split(/\r?\n/);
  const items: ReadAlsoItem[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const match = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (!match) {
      continue;
    }

    const title = match[1]?.trim();
    const href = match[2]?.trim();
    if (!title || !href) {
      continue;
    }

    const trailingText = line.slice(match.index! + match[0].length).trim();
    let snippet = trailingText;

    if (!snippet) {
      let nextLineIndex = i + 1;
      while (nextLineIndex < lines.length && !lines[nextLineIndex].trim()) {
        nextLineIndex += 1;
      }

      if (nextLineIndex < lines.length) {
        snippet = lines[nextLineIndex].trim();
      }
    }

    const normalizedSnippet = snippet.replace(/\s+/g, ' ').trim();

    items.push({
      title,
      href,
      snippet: normalizedSnippet
    });
  }

  return items;
}
