import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (!request.nextUrl.searchParams.has('q')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set('X-Robots-Tag', 'noindex, follow');
  return response;
}
