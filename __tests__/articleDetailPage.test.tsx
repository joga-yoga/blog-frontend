import { render, screen } from '@testing-library/react';
import ArticlePage from '../app/artykuly/[slug]/page';
import { getArticle } from '@/lib/api/client';
import { resetSiteConfigCache } from '@/lib/site';

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client');
  return {
    ...actual,
    getArticle: jest.fn()
  };
});

const mockedGetArticle = getArticle as jest.MockedFunction<typeof getArticle>;

beforeEach(() => {
  mockedGetArticle.mockReset();
  process.env.NEXT_PUBLIC_SITE_URL = 'https://wiedza.joga.yoga';
  resetSiteConfigCache();
});

it('renders article sections, FAQ and citations', async () => {
  mockedGetArticle.mockResolvedValue({
    topic: 'Transformacja energetyczna',
    slug: 'transformacja-energetyczna',
    locale: 'pl-PL',
    taxonomy: {
      section: 'Energetyka',
      categories: ['Energia odnawialna'],
      tags: ['energetyka', 'transformacja']
    },
    seo: {
      title: 'Transformacja energetyczna',
      description: 'Opis SEO',
      slug: 'transformacja-energetyczna',
      canonical: 'https://example.com/artykuly/transformacja-energetyczna',
      robots: 'index,follow'
    },
    article: {
      headline: 'Transformacja energetyczna',
      lead: 'Wprowadzenie do transformacji energetycznej.',
      sections: [
        { title: 'Sytuacja na rynku', body: 'Treść sekcji **bogata** w informacje.' }
      ],
      citations: [
        {
          url: 'https://example.com/zrodlo',
          label: 'Źródło'
        }
      ]
    },
    aeo: {
      geo_focus: ['Polska'],
      faq: [{ question: 'Co to jest transformacja energetyczna?', answer: 'To zmiana miksu energetycznego.' }]
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  });

  const ui = await ArticlePage({ params: Promise.resolve({ slug: 'transformacja-energetyczna' }) });
  render(ui);

  expect(screen.getByRole('heading', { level: 1, name: /Transformacja energetyczna/i })).toBeInTheDocument();
  expect(screen.getByText('Wprowadzenie do transformacji energetycznej.')).toBeInTheDocument();
  expect(screen.getByText('Źródło')).toBeInTheDocument();
  expect(screen.getByText(/Co to jest transformacja energetyczna/i)).toBeInTheDocument();
});
