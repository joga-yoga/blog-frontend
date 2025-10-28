import { assertValidCanonical, buildArticleCanonical, buildCanonicalUrl, resetSiteConfigCache } from '@/lib/site';

describe('canonical URL helpers', () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/blog';
    resetSiteConfigCache();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    resetSiteConfigCache();
  });

  it('builds canonical URL for root path', () => {
    const canonical = buildCanonicalUrl('/');
    expect(canonical).toBe('https://example.com/blog/');
  });

  it('builds article canonical with sanitized slug', () => {
    const canonical = buildArticleCanonical('/transformacja-energetyczna/');
    expect(canonical).toBe('https://example.com/blog/artykuly/transformacja-energetyczna');
  });

  it('includes sanitized page query for paginated listing', () => {
    const canonical = buildCanonicalUrl('/artykuly', new URLSearchParams({ page: '2', utm_source: 'test' }));
    expect(canonical).toBe('https://example.com/blog/artykuly?page=2');
  });

  it('omits invalid or default page query values', () => {
    expect(buildCanonicalUrl('/artykuly', new URLSearchParams({ page: '1' }))).toBe(
      'https://example.com/blog/artykuly'
    );
    expect(buildCanonicalUrl('/artykuly', new URLSearchParams({ page: 'abc' }))).toBe(
      'https://example.com/blog/artykuly'
    );
  });

  it('rejects canonical URLs that point to external hosts', () => {
    expect(() => assertValidCanonical('https://malicious.example/artykuly/foo')).toThrow(
      /must remain on hostname/
    );
  });

  it('rejects canonical URLs that use http', () => {
    expect(() => assertValidCanonical('http://example.com/blog/artykuly/foo')).toThrow(/must use https/);
  });
});
