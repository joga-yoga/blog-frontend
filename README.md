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

Skopiuj plik `.env.example` do `.env` i uzupełnij dane połączenia z bazą danych:

```bash
cp .env.example .env
```

Następnie zaktualizuj wartość `DATABASE_URL`.

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

## Generowanie klienta Prisma

Po każdej zmianie schematu Prisma uruchom:

```bash
npx prisma generate
```

## Stylowanie

Projekt korzysta z Tailwind CSS wraz z wtyczką `@tailwindcss/typography`.
