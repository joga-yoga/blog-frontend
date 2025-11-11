import { buildMarkdown, ensureTrailingNewline, escapeYamlString, extractPersistedDates, normalizeNewlines } from '../../tools/src/markdown';
import { ArticlePayload } from '../../tools/src/types';

describe('markdown helpers', () => {
  it('normalizes windows newlines', () => {
    expect(normalizeNewlines('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('ensures trailing newline', () => {
    expect(ensureTrailingNewline('abc')).toBe('abc\n');
    expect(ensureTrailingNewline('abc\n')).toBe('abc\n');
  });

  it('escapes double quotes for yaml', () => {
    expect(escapeYamlString('a "quote" here')).toBe('a \\"quote\\" here');
  });

  it('builds deterministic markdown', () => {
    const payload: ArticlePayload = {
      seo: {
        title: 'Test title',
        description: 'Description with "quotes"',
        slug: 'test-slug'
      },
      taxonomy: {
        section: 'insight',
        categories: ['cat-1'],
        tags: ['tag-1', 'tag-2']
      },
      aeo: {
        geo_focus: ['PL'],
        faq: [
          { question: 'What is yoga?', answer: 'Yoga is movement.' }
        ]
      },
      article: {
        lead: 'Lead paragraph.',
        headline: 'Headline text',
        sections: [
          { title: 'Section A', body: 'Line 1\r\nLine 2' }
        ],
        citations: ['Source A'],
        datePublished: '2024-01-01T00:00:00.000Z',
        dateModified: '2024-01-02T00:00:00.000Z'
      }
    };

    const result = buildMarkdown(payload, new Date('2023-01-01T00:00:00.000Z'));
    expect(result).toMatchInlineSnapshot(`
"---\ntitle: \"Test title\"\ndescription: \"Description with \\\"quotes\\\"\"\ncanonical: \"https://wiedza.joga.yoga/artykuly/test-slug\"\nslug: \"test-slug\"\nlocale: \"pl-PL\"\nrobots: \"index,follow\"\nsection: \"insight\"\ncategories: [\"cat-1\"]\ntags: [\"tag-1\",\"tag-2\"]\ngeo_focus: [\"PL\"]\ndatePublished: \"2024-01-01T00:00:00.000Z\"\ndateModified: \"2024-01-02T00:00:00.000Z\"\n---\n\n# TL;DR\nLead paragraph.\n\n# Headline text\n## Section A\nLine 1\nLine 2\n\n## FAQ\n**What is yoga?**  \nYoga is movement.\n\n## Źródła / Citations\n- Source A\n"
`);
  });

  it('reuses persisted dates when payload does not provide them', () => {
    const payload: ArticlePayload = {
      seo: {
        title: 'Another title',
        description: 'Desc',
        slug: 'another-slug'
      },
      taxonomy: {
        section: 'practice'
      },
      aeo: {
        geo_focus: []
      },
      article: {
        lead: 'Lead',
        headline: 'Headline',
        sections: [
          { title: 'Section', body: 'Body' }
        ],
        citations: []
      }
    };

    const existing = `---\n` +
      'datePublished: "2023-05-05T00:00:00.000Z"\n' +
      'dateModified: "2023-06-06T00:00:00.000Z"\n---\n';
    const persisted = extractPersistedDates(existing);
    const markdown = buildMarkdown(payload, new Date('2024-01-01T00:00:00.000Z'), persisted);
    expect(markdown).toContain('datePublished: "2023-05-05T00:00:00.000Z"');
    expect(markdown).toContain('dateModified: "2023-06-06T00:00:00.000Z"');
  });
});
