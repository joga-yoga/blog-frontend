import { apiFetch, buildUrl, getArticles, serializeArticleListQuery } from '@/lib/api/client';

describe('API client utilities', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('serializes pagination and filters correctly', () => {
    expect(
      serializeArticleListQuery({
        page: 2,
        per_page: 100,
        section: '  Biznes ',
        q: ' gospodarka '
      })
    ).toEqual({
      page: '2',
      per_page: '50',
      section: 'Biznes',
      q: 'gospodarka'
    });
  });

  it('builds URLs relative to the configured base', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://example.com/api';
    const url = buildUrl('/articles', { page: 3, section: 'Finanse' });
    expect(url.toString()).toBe('https://example.com/api/articles?page=3&section=Finanse');
  });

  it('adds JSON headers and parses responses', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://example.com';

    const json = jest.fn().mockResolvedValue({ ok: true });
    const headers = new Headers({ 'content-type': 'application/json' });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers,
      json,
      text: jest.fn()
    } as unknown as Response);

    const response = await apiFetch('/health');

    expect(global.fetch).toHaveBeenCalledWith(new URL('https://example.com/health'), expect.any(Object));
    const requestInit = (global.fetch as jest.Mock).mock.calls[0][1];
    expect((requestInit.headers as Headers).get('Accept')).toBe('application/json');
    expect(response).toEqual({ ok: true });
  });

  it('fetches article listings and normalizes values', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://example.com';

    const payload = {
      meta: { page: 1, per_page: 10, total_items: 1, total_pages: 1 },
      items: [
        {
          slug: 'test',
          title: 'Test',
          section: 'Finanse',
          tags: ['a', 'b'],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ]
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValue(payload),
      text: jest.fn()
    } as unknown as Response);

    const result = await getArticles({ page: 1, per_page: 10 });

    expect(result.meta.total_items).toBe(1);
    expect(result.items[0].tags).toEqual(['a', 'b']);
    const [requestUrl] = (global.fetch as jest.Mock).mock.calls[0];
    expect((requestUrl as URL).toString()).toBe('https://example.com/articles?page=1&per_page=10');
  });
});
