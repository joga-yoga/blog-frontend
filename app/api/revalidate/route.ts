import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

const ARTICLES_TAG = 'articles';

export async function POST(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag');

  if (tag !== ARTICLES_TAG) {
    return NextResponse.json(
      { revalidated: false, message: 'Unsupported tag' },
      { status: 400 }
    );
  }

  revalidateTag(ARTICLES_TAG);

  return NextResponse.json({ revalidated: true, tag: ARTICLES_TAG, now: Date.now() });
}
