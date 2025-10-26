# Blog Frontend

Aplikacja oparta o Next.js (App Router) renderująca artykuły dostarczane przez usługę **blog-backend**.

## Wymagania wstępne

- Node.js 18+
- Działająca instancja serwisu `blog-backend` (FastAPI)

## Instalacja

```bash
npm install
```

## Konfiguracja środowiska

Skopiuj plik `.env.example` do `.env` i ustaw adres API backendu:

```bash
cp .env.example .env
```

Kluczowa zmienna:

- `NEXT_PUBLIC_API_BASE_URL` – podstawowy adres URL usługi `blog-backend` (np. `https://api.example.com`).

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

## Stylowanie

Projekt korzysta z Tailwind CSS oraz wtyczki `@tailwindcss/typography`.

## Testowanie integracji SEO

- Feedy: `curl http://localhost:3000/feed.json` oraz `curl http://localhost:3000/feed.xml`
- Pliki indeksujące: `curl http://localhost:3000/robots.txt` oraz `curl http://localhost:3000/sitemap.xml`
- Ręczna inwalidacja cache po publikacji: `curl -X POST "http://localhost:3000/api/revalidate?tag=articles"`
