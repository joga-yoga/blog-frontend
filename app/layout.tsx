import Link from 'next/link';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
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
            <Link href="/" className="text-2xl font-semibold text-slate-900">
              Blog
            </Link>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Inspiracje, analizy i najlepsze praktyki dla polskich czytelników.
            </p>
          </header>
          <main className="flex-1 pb-16">{children}</main>
          <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500">
            © {new Date().getFullYear()} Blog. Wszelkie prawa zastrzeżone.
          </footer>
        </div>
      </body>
    </html>
  );
}
