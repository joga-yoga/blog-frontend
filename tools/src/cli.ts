import process from 'process';
import { buildMarkdown, extractPersistedDates } from './markdown';
import { ensureOutputDirectory, readFileIfExists, resolveMarkdownPath, writeFileAtomic } from './file-utils';
import { loadPayloads } from './data-loader';
import { articlePayloadSchema } from './types';
import type { ArticlePayload } from './types';

interface Summary {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

const createInitialSummary = (): Summary => ({ processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 });

const logError = (slug: string | undefined, error: unknown): void => {
  const reason = error instanceof Error ? error.message : String(error);
  const slugLabel = slug ? `slug="${slug}"` : 'slug=<unknown>';
  console.error(`✖ Failed to process ${slugLabel}: ${reason}`);
};

const processPayload = async (
  payload: ArticlePayload,
  summary: Summary,
  generationTimestamp: Date
): Promise<void> => {
  const slug = payload.seo.slug;
  const outputPath = resolveMarkdownPath(slug);
  const existing = await readFileIfExists(outputPath);
  const persistedDates = existing ? extractPersistedDates(existing) : undefined;
  const markdown = buildMarkdown(payload, generationTimestamp, persistedDates);

  if (existing && existing === markdown) {
    summary.skipped += 1;
    summary.processed += 1;
    console.info(`• ${slug}: up-to-date`);
    return;
  }

  await writeFileAtomic(outputPath, markdown);
  if (existing === null) {
    summary.created += 1;
    console.info(`✓ ${slug}: created`);
  } else {
    summary.updated += 1;
    console.info(`✓ ${slug}: updated`);
  }
  summary.processed += 1;
};

const run = async (): Promise<number> => {
  const [, , maybeInput] = process.argv;
  const summary = createInitialSummary();
  await ensureOutputDirectory();

  let rawPayloads;
  try {
    rawPayloads = await loadPayloads(maybeInput);
  } catch (error) {
    console.error(`Fatal: unable to load payloads${maybeInput ? ` from ${maybeInput}` : ''}:`, error);
    return 1;
  }

  if (rawPayloads.length === 0) {
    console.warn('No payloads found. Nothing to do.');
    console.info('Summary: processed=0 created=0 updated=0 skipped=0 failed=0');
    return 0;
  }

  const generationTimestamp = new Date();

  for (const raw of rawPayloads) {
    const result = articlePayloadSchema.safeParse(raw.data);
    if (!result.success) {
      summary.failed += 1;
      const slug = typeof (raw.data as { seo?: { slug?: unknown } }).seo?.slug === 'string'
        ? (raw.data as { seo?: { slug?: string } }).seo!.slug
        : undefined;
      logError(slug, result.error);
      continue;
    }

    try {
      await processPayload(result.data, summary, generationTimestamp);
    } catch (error) {
      summary.failed += 1;
      logError(result.data.seo.slug, error);
    }
  }

  const total = `Summary: processed=${summary.processed} created=${summary.created} updated=${summary.updated} skipped=${summary.skipped} failed=${summary.failed}`;
  if (summary.failed > 0) {
    console.error(total);
    return 1;
  }

  console.info(total);
  return 0;
};

run()
  .then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  })
  .catch((error) => {
    console.error('Fatal execution error:', error);
    process.exitCode = 1;
  });
