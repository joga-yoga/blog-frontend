import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wiedza.joga.yoga';
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? 'GTM-MJJHVX9H';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Blog joga.yoga – Wiedza, Inspiracje i Trendy Jogowe w Polsce',
    template: '%s | joga.yoga – Blog o jodze, wellness i podróżach duchowych'
  },
  description:
    'Polski blog o jodze i świadomym życiu. Poznaj inspirujące artykuły o jodze, medytacji, oddechu, wyjazdach jogowych i trendach wellness w Polsce i na świecie. Wiedza dla nauczycieli, praktykujących i miłośników zdrowego stylu życia.',
  alternates: {
    types: {
      'application/json': '/feed.json',
      'application/atom+xml': '/feed.xml'
    }
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  other: {
    'apple-mobile-web-app-title': 'joga.yoga',
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-white text-slate-900">
        {/* Google Tag Manager (noscript) — должен быть самым верхним в <body> */}
        {GTM_ID && (
          <noscript
            dangerouslySetInnerHTML={{
              __html: `
                <iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
                  height="0" width="0" style="display:none;visibility:hidden"></iframe>
              `,
            }}
          />
        )}

        {/* Google Tag Manager */}
        {GTM_ID && (
          <Script id="gtm-init" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${GTM_ID}');
            `}
          </Script>
        )}
        {/* End Google Tag Manager */}

        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-12 border-b border-gray-200 pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/" className="text-2xl font-semibold text-slate-900">
                Blog joga.yoga — Polska
              </Link>
              <nav className="flex items-center gap-3 text-sm font-medium text-gray-600">
                <Link href="https://chatgpt.com/g/g-68fe777386b081919b32d3e839aba91c-wiedza-joga-yoga-milosc-spokoj-i-uwaznosc" className="rounded-md px-3 py-1 hover:bg-gray-100">
                  GPTs bloga
                </Link>
                <Link href="/generator" className="rounded-md px-3 py-1 hover:bg-gray-100">
                  Generator artykułów (beta)
                </Link>
              </nav>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-gray-600">
              Polski blog o jodze, medytacji i świadomym życiu. Trendy wellness 2026, praktyka, zdrowie i wyjazdy jogowe w Polsce i za granicą.
            </p>
          </header>
          <main className="flex-1 pb-16">{children}</main>
          <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500">
            © {new Date().getFullYear()} joga.yoga — Wszelkie prawa zastrzeżone. {' '}
            <Link href="/privacy-policy">Polityka prywatności</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
