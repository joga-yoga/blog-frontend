import { render, screen } from '@testing-library/react';
import HomePage from '../app/page';
import { getArticles, getHealth, ServiceUnavailableError } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client');
  return {
    ...actual,
    getArticles: jest.fn(),
    getHealth: jest.fn()
  };
});

const mockedGetArticles = getArticles as jest.MockedFunction<typeof getArticles>;
const mockedGetHealth = getHealth as jest.MockedFunction<typeof getHealth>;

function createArticleSummary(
  overrides: Partial<Awaited<ReturnType<typeof getArticles>>['items'][number]> = {}
) {
  return {
    slug: 'testowy-artykul',
    title: 'Testowy artykuł',
    section: 'Finanse',
    tags: ['polska', 'ekonomia'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    ...overrides
  };
}

beforeEach(() => {
  mockedGetArticles.mockReset();
  mockedGetHealth.mockReset();
});

it('renders articles with pagination and tags', async () => {
  mockedGetArticles.mockResolvedValue({
    meta: { page: 1, per_page: 10, total_items: 1, total_pages: 1 },
    items: [createArticleSummary()]
  });

  mockedGetHealth.mockResolvedValue({
    status: 'ok',
    db: 'ok',
    driver: 'postgres',
    database_url_present: true
  });

  const ui = await HomePage({ searchParams: Promise.resolve({}) });
  render(ui);

  expect(screen.getByText('Najnowsze artykuły')).toBeInTheDocument();
  expect(screen.getByText('Testowy artykuł')).toBeInTheDocument();
  expect(screen.getByText('#polska')).toBeInTheDocument();
});

it('shows service downtime message when backend fails', async () => {
  mockedGetArticles.mockRejectedValue(new ServiceUnavailableError(503, 'https://example.com/artykuly'));
  mockedGetHealth.mockResolvedValue({
    status: 'down',
    db: 'down',
    driver: 'postgres',
    database_url_present: false
  });

  const ui = await HomePage({ searchParams: Promise.resolve({}) });
  render(ui);

  expect(screen.getByText('Serwis chwilowo niedostępny')).toBeInTheDocument();
});
