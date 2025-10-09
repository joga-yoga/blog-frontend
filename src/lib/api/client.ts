import {
  articleCreateRequestSchema,
  articleDetailResponseSchema,
  articleDocumentSchema,
  articlePublishResponseSchema,
  articleSchemaResponseSchema,
  healthResponseSchema,
  parseArticleListResponse,
  rubricsResponseSchema,
  type ArticleCreateRequest,
  type ArticleDetailResponse,
  type ArticleListQuery,
  type ArticleListResponse,
  type ArticlePublishResponse,
  type ArticleSchemaResponse,
  type HealthResponse,
  type Rubric
} from './types';

const DEFAULT_BASE_URL = 'http://localhost:8000';

export const MAX_PER_PAGE = 50;
export const MIN_PER_PAGE = 1;

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body?: unknown;

  constructor(message: string, status: number, url: string, body?: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export class NotFoundError extends ApiError {
  constructor(url: string, body?: unknown) {
    super('Resource not found', 404, url, body);
    this.name = 'NotFoundError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(status: number, url: string, body?: unknown) {
    super('Service temporarily unavailable', status, url, body);
    this.name = 'ServiceUnavailableError';
  }
}

export class NetworkError extends ApiError {
  constructor(url: string, cause: unknown) {
    super('Network request failed', 0, url, undefined, { cause });
    this.name = 'NetworkError';
  }
}

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: RequestInit['body'];
  searchParams?: Record<string, string | number | boolean | null | undefined | Array<string | number | boolean>>;
  revalidate?: number | false;
};

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || DEFAULT_BASE_URL;
}

export function buildUrl(path: string, searchParams?: ApiRequestOptions['searchParams']): URL {
  const base = getApiBaseUrl();
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, normalizedBase);

  if (searchParams) {
    for (const [key, rawValue] of Object.entries(searchParams)) {
      if (rawValue === undefined || rawValue === null) continue;

      const values = Array.isArray(rawValue) ? rawValue : [rawValue];

      for (const value of values) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return url;
}

export function serializeArticleListQuery(query: ArticleListQuery): Record<string, string> {
  const params: Record<string, string> = {};

  if (typeof query.page === 'number' && Number.isFinite(query.page) && query.page >= 1) {
    params.page = String(Math.floor(query.page));
  }

  if (typeof query.per_page === 'number' && Number.isFinite(query.per_page)) {
    const bounded = Math.min(Math.max(Math.floor(query.per_page), MIN_PER_PAGE), MAX_PER_PAGE);
    params.per_page = String(bounded);
  }

  if (query.section && query.section.trim()) {
    params.section = query.section.trim();
  }

  if (query.q && query.q.trim()) {
    params.q = query.q.trim();
  }

  return params;
}

export async function apiFetch<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
  const { searchParams, revalidate, headers, body, ...rest } = options;

  const url = buildUrl(path, searchParams);
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');

  const init: RequestInit & { next?: { revalidate?: number | false } } = {
    ...rest,
    headers: requestHeaders
  };

  if (revalidate !== undefined) {
    init.next = { ...(rest as { next?: { revalidate?: number | false } }).next, revalidate };
  }

  if (body !== undefined) {
    init.body = body;
  }

  const method = (init.method ?? 'GET').toUpperCase();

  if (method !== 'GET' && method !== 'HEAD' && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, init);
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError(url.toString(), payload ?? undefined);
      }

      if (response.status === 502 || response.status === 503) {
        throw new ServiceUnavailableError(response.status, url.toString(), payload ?? undefined);
      }

      throw new ApiError(`Request failed with status ${response.status}`, response.status, url.toString(), payload ?? undefined);
    }

    return (payload ?? null) as TResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new NetworkError(url.toString(), error);
  }
}

export async function getHealth(options?: Pick<ApiRequestOptions, 'revalidate'>): Promise<HealthResponse> {
  const data = await apiFetch<unknown>('/health', { revalidate: options?.revalidate });
  return healthResponseSchema.parse(data);
}

export async function getArticleSchema(options?: Pick<ApiRequestOptions, 'revalidate'>): Promise<ArticleSchemaResponse> {
  const data = await apiFetch<unknown>('/schemas/article', { revalidate: options?.revalidate });
  return articleSchemaResponseSchema.parse(data);
}

export async function getArticles(query: ArticleListQuery, options?: Pick<ApiRequestOptions, 'revalidate'>): Promise<ArticleListResponse> {
  const params = serializeArticleListQuery(query);
  const data = await apiFetch<unknown>('/articles', { searchParams: params, revalidate: options?.revalidate });
  return parseArticleListResponse(data);
}

export async function getArticle(slug: string, options?: Pick<ApiRequestOptions, 'revalidate'>): Promise<ArticleDetailResponse> {
  const data = await apiFetch<unknown>(`/articles/${encodeURIComponent(slug)}`, { revalidate: options?.revalidate });
  return articleDetailResponseSchema.parse(data);
}

export async function createArticle(payload: ArticleCreateRequest): Promise<ArticlePublishResponse> {
  const body = articleCreateRequestSchema.parse(payload);
  const data = await apiFetch<unknown>('/articles', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return articlePublishResponseSchema.parse(data);
}

export async function getRubrics(options?: Pick<ApiRequestOptions, 'revalidate'>): Promise<Rubric[]> {
  const data = await apiFetch<unknown>('/rubrics', { revalidate: options?.revalidate });
  return rubricsResponseSchema.parse(data).filter((rubric) => rubric.is_active);
}

export async function getArticlePreview(slug: string, options?: Pick<ApiRequestOptions, 'revalidate'>) {
  const data = await apiFetch<unknown>(`/posts/${encodeURIComponent(slug)}`, { revalidate: options?.revalidate });
  return articleDocumentSchema.parse(data);
}
