import type { Metadata } from "next";
import { Suspense } from "react";

import { ArticleGeneratorForm } from "@/components/articles/ArticleGeneratorForm";
import { getArticleSchema, getRubrics } from "@/lib/api/client";
import { buildCanonicalUrl } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Generator artykułów",
  description:
    "Złóż zamówienie na nowy artykuł, korzystając z rubryk i wskazówek SEO.",
  alternates: {
    canonical: buildCanonicalUrl("/generator"),
  },
};

export default async function ArticleGeneratorPage() {
  const [rubricsResult, schemaResult] = await Promise.allSettled([
    getRubrics({ revalidate }),
    getArticleSchema({ revalidate }),
  ]);

  const rubrics =
    rubricsResult.status === "fulfilled" ? rubricsResult.value : [];
  const schema = schemaResult.status === "fulfilled" ? schemaResult.value : null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Zamów nowy artykuł
        </h1>
        <p className="max-w-2xl text-gray-600">
          Wprowadź temat albo link do YouTube, dodaj wskazówki i opcjonalną
          rubrykę, a nasz asystent przygotuje artykuł zgodny z aktualnym
          schematem redakcyjnym.
        </p>
      </header>

      {/* Suspense boundary required for client components that use useSearchParams */}
      <Suspense
        fallback={
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            Ładowanie generatora artykułów…
          </div>
        }
      >
        <ArticleGeneratorForm rubrics={rubrics} />
      </Suspense>

      {schema ? (
        <details className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Podgląd schematu artykułu
          </summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-gray-600">
            {JSON.stringify(schema, null, 2)}
          </pre>
        </details>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
          Nie udało się pobrać schematu artykułu. Formularz nadal działa, ale
          brak podpowiedzi struktury.
        </div>
      )}
    </div>
  );
}
