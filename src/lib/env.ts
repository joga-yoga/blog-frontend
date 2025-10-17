const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!rawApiBaseUrl) {
  throw new Error(
    'Environment variable NEXT_PUBLIC_API_BASE_URL is not defined. Please set it in your environment.'
  );
}

let parsedApiBaseUrl: URL;

try {
  parsedApiBaseUrl = new URL(rawApiBaseUrl);
} catch (error) {
  throw new Error(
    `Environment variable NEXT_PUBLIC_API_BASE_URL must be a valid absolute URL. Received: "${rawApiBaseUrl}".`
  );
}

const normalizedApiBaseUrl = `${parsedApiBaseUrl.origin}${parsedApiBaseUrl.pathname.replace(/\/$/, '')}`;

export const env = {
  NEXT_PUBLIC_API_BASE_URL: normalizedApiBaseUrl,
} as const;

export const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL;
