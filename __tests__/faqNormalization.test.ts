import { articleDetailResponseSchema } from '@/lib/api/types';

const baseArticle = {
  topic: 'Test',
  slug: 'test',
  locale: 'pl-PL',
  taxonomy: {
    section: 'Test',
    categories: [],
    tags: []
  },
  seo: {
    title: 'Test',
    description: 'Opis',
    slug: 'test'
  },
  article: {
    headline: 'Naglowek',
    lead: 'Lead',
    sections: [{ title: 'Sekcja', body: 'Treść' }],
    citations: []
  },
  aeo: {
    geo_focus: []
  }
};

describe('FAQ normalization', () => {
  it('maps root-level faq entries with q/a keys into aeo.faq', () => {
    const parsed = articleDetailResponseSchema.parse({
      ...baseArticle,
      faq: [{ q: 'Pytanie? ', a: ' Odpowiedź ' }]
    });

    expect(parsed.aeo.faq).toEqual([
      {
        question: 'Pytanie?',
        answer: 'Odpowiedź'
      }
    ]);
  });

  it('falls back to aeo.faq when no root-level faq is present', () => {
    const parsed = articleDetailResponseSchema.parse({
      ...baseArticle,
      aeo: {
        geo_focus: ['PL'],
        faq: [
          {
            question: 'Co zyskam?',
            answer: 'Lepszą strukturę FAQ.'
          },
          {
            q: 'Brak odpowiedzi'
          }
        ]
      }
    });

    expect(parsed.aeo.faq).toEqual([
      {
        question: 'Co zyskam?',
        answer: 'Lepszą strukturę FAQ.'
      }
    ]);
  });
});
