import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Blog',
    template: '%s | Blog'
  },
  description: 'Aktualności i artykuły z naszego bloga.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-12 border-b border-gray-200 pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/" className="text-2xl font-semibold text-slate-900">
                Blog
              </Link>
              <nav className="flex items-center gap-3 text-sm font-medium text-gray-600">
                <Link href="/" className="rounded-md px-3 py-1 hover:bg-gray-100">
                  Artykuły
                </Link>
                <Link href="/generator" className="rounded-md px-3 py-1 hover:bg-gray-100">
                  Generator artykułów
                </Link>
              </nav>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-gray-600">
              Inspiracje, analizy i najlepsze praktyki dla polskich czytelników.
            </p>
          </header>
          <main className="flex-1 pb-16">{children}</main>
          <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500">
            © {new Date().getFullYear()} Wszelkie prawa zastrzeżone. joga.yoga
          </footer>
        </div>
      </body>
    </html>
  );
}
