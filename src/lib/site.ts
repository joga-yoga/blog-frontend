const DEFAULT_SITE_URL = 'https://wiedza.joga.yoga';

type SiteConfig = {
  baseUrl: string;
  basePathname: string;
  hostname: string;
};

let cachedSiteConfig: SiteConfig | null = null;

function normalizeSiteUrl(url: URL): Pick<SiteConfig, 'baseUrl' | 'basePathname'> {
  const normalizedPath = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
  const baseUrl = `${url.origin}${normalizedPath === '/' ? '' : normalizedPath}`;
  return { baseUrl, basePathname: normalizedPath };
}

function resolveSiteConfig(): SiteConfig {
  if (cachedSiteConfig) {
    return cachedSiteConfig;
  }

  const rawValue = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;

  let parsed: URL;

  try {
    parsed = new URL(rawValue);
  } catch (error) {
    throw new Error(
      `Environment variable NEXT_PUBLIC_SITE_URL must be a valid absolute URL. Received: "${rawValue}".`
    );
  }

  if (parsed.protocol !== 'https:') {
    if (process.env.NODE_ENV === 'test') {
      parsed = new URL(DEFAULT_SITE_URL);
    } else {
      throw new Error('NEXT_PUBLIC_SITE_URL must use the https protocol.');
    }
  }

  if (!parsed.hostname) {
    throw new Error('NEXT_PUBLIC_SITE_URL must include a hostname.');
  }

  const { baseUrl, basePathname } = normalizeSiteUrl(parsed);

  cachedSiteConfig = {
    baseUrl,
    basePathname,
    hostname: parsed.hostname
  } satisfies SiteConfig;

  return cachedSiteConfig;
}

export function getSiteBaseUrl(): string {
  return resolveSiteConfig().baseUrl;
}

function isAllowedCanonicalSearchParam(key: string): boolean {
  return key === 'page';
}

export function assertValidCanonical(url: string): string {
  const { hostname, basePathname } = resolveSiteConfig();

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error(`Invalid canonical URL provided: "${url}".`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Canonical URL must use https. Received protocol: ${parsed.protocol}`);
  }

  if (!parsed.hostname.endsWith(hostname)) {
    throw new Error(`Canonical URL must remain on hostname "${hostname}". Received: "${parsed.hostname}".`);
  }

  if (parsed.hash) {
    throw new Error('Canonical URL must not contain hash fragments.');
  }

  if (parsed.search) {
    const params = parsed.searchParams;
    for (const key of params.keys()) {
      if (!isAllowedCanonicalSearchParam(key)) {
        throw new Error(`Canonical URL contains unsupported query parameter "${key}".`);
      }
    }

    const pageValue = params.get('page');
    if (pageValue && !/^[1-9]\d*$/.test(pageValue)) {
      throw new Error('Canonical page query parameter must be a positive integer.');
    }
  }

  if (parsed.pathname !== '/' && parsed.pathname !== `${basePathname}/`) {
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    parsed.pathname = normalizedPath || '/';
  }

  return parsed.toString();
}

function buildCanonicalInternal(pathname: string, searchParams?: URLSearchParams): string {
  const { baseUrl } = resolveSiteConfig();

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const trimmedPath = normalizedPath === '/' ? '/' : normalizedPath.replace(/\/+$/, '');

  const url = new URL(`${baseUrl}${trimmedPath === '/' ? '/' : trimmedPath}`);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return assertValidCanonical(url.toString());
}

export function buildCanonicalUrl(pathname: string, search?: URLSearchParams | string | null): string {
  let params: URLSearchParams | undefined;

  if (typeof search === 'string') {
    params = new URLSearchParams(search);
  } else if (search instanceof URLSearchParams) {
    params = new URLSearchParams(search.toString());
  }

  if (params) {
    const filtered = new URLSearchParams();
    const pageValue = params.get('page');
    if (pageValue && pageValue !== '1' && /^[1-9]\d*$/.test(pageValue)) {
      filtered.set('page', pageValue);
    }
    params = filtered;
  }

  return buildCanonicalInternal(pathname, params);
}

export function buildArticleCanonical(slug: string): string {
  const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, '');
  return buildCanonicalUrl(`/artykuly/${normalizedSlug}`);
}

export function resetSiteConfigCache(): void {
  cachedSiteConfig = null;
}
