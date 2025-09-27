import Link from 'next/link';

export default function ArticleNotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Nie znaleziono artykułu</h1>
      <p className="text-gray-600">
        Wygląda na to, że szukany artykuł został przeniesiony lub nigdy nie istniał.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        Wróć na stronę główną
      </Link>
    </div>
  );
}
