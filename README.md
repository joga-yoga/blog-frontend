# Blog Frontend

A Next.js (App Router) frontend for rendering public blog content backed by PostgreSQL and Prisma.

## Wymagania wstępne

- Node.js 18+
- Dostęp do bazy danych PostgreSQL oraz poprawnie ustawiona zmienna środowiskowa `DATABASE_URL`

## Instalacja

```bash
npm install
```

## Konfiguracja środowiska

Skopiuj plik `.env.example` do `.env` i uzupełnij wymagane wartości:

```bash
cp .env.example .env
```

Następnie ustaw zmienne środowiskowe:

- `DATABASE_URL` – połączenie z bazą danych (tylko dla lokalnego rozwoju).
- `NEXT_PUBLIC_SITE_URL` – pełny adres aplikacji (np. `https://wiedza.joga.yoga`).
- `NEXT_PUBLIC_BACKEND_URL` – host wdrożonego backendu (np. `https://backend.example.com`).

> Na Vercelu skonfiguruj powyższe zmienne w zakładce **Project → Settings → Environment Variables**.

## Uruchomienie w trybie deweloperskim

```bash
npm run dev
```

Aplikacja będzie domyślnie dostępna pod adresem [http://localhost:3000](http://localhost:3000).

## Budowanie i uruchamianie w produkcji

```bash
npm run build
npm run start
```

## Proxy do backendu

Aplikacja korzysta z konfiguracji `rewrites` Next.js, aby serwować zapytania pod `/api/*` bezpośrednio z backendu. Dzięki temu unikamy problemów z CORS i możemy używać względnych ścieżek (`fetch('/api/posts')`).

Proxy dodaje nagłówek `Cache-Control: no-store` dla odpowiedzi backendu oraz ustawia nagłówki bezpieczeństwa (`Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`).

## Kontrakt API danych

- Lista artykułów: `GET /api/posts` – zwraca tablicę obiektów z kluczami `slug`, `title`, `lead`, `section`, `tags`, `created_at` itd.
- Pojedynczy artykuł: `GET /api/posts/{slug}` – zwraca obiekt artykułu z polami `body_mdx`, `faq`, `citations`.

Komponenty frontendu normalizują odpowiedź, dlatego dodatkowe opakowania (`{ data: [...] }`, `{ post: {...} }`) są również obsługiwane.

## Generowanie klienta Prisma

Po każdej zmianie schematu Prisma uruchom:

```bash
npx prisma generate
```

## Stylowanie

Projekt korzysta z Tailwind CSS wraz z wtyczką `@tailwindcss/typography`.
