import { NextResponse } from 'next/server';
import { getSiteBaseUrl } from '@/lib/site';

export const revalidate = 3600;

export function GET() {
  const siteUrl = getSiteBaseUrl();
  const body = `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=600'
    }
  });
}
