'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createArticle, ApiError, ServiceUnavailableError } from '@/lib/api/client';
import { articleCreateRequestSchema, type ArticleCreateRequest, type Rubric } from '@/lib/api/types';

type ArticleGeneratorFormProps = {
  rubrics: Rubric[];
};

type FieldErrors = Partial<Record<'topic' | 'keywords' | 'guidance', string>>;

function parseKeywords(value: string): string[] {
  if (!value.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .map((keyword) => keyword.slice(0, 80))
    .slice(0, 6);
}

export function ArticleGeneratorForm({ rubrics }: ArticleGeneratorFormProps): JSX.Element {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const topic = String(formData.get('topic') ?? '').trim();
    const rubricCode = String(formData.get('rubric_code') ?? '').trim();
    const keywordsRaw = String(formData.get('keywords') ?? '');
    const guidanceRaw = String(formData.get('guidance') ?? '');

    const payload: ArticleCreateRequest = {
      topic,
      rubric_code: rubricCode || undefined,
      keywords: parseKeywords(keywordsRaw),
      guidance: guidanceRaw.trim() ? guidanceRaw.trim() : undefined
    };

    const validation = articleCreateRequestSchema.safeParse(payload);

    if (!validation.success) {
      const { fieldErrors: validationErrors } = validation.error.flatten();
      setFieldErrors({
        topic: validationErrors.topic?.[0],
        keywords: validationErrors.keywords?.[0],
        guidance: validationErrors.guidance?.[0]
      });
      setError('Popraw zaznaczone pola i spróbuj ponownie.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const result = await createArticle(validation.data);
      router.push(`/artykuly/${result.slug}`);
    } catch (err) {
      if (err instanceof ServiceUnavailableError) {
        setError('Generowanie artykułu jest chwilowo niedostępne. Spróbuj ponownie za kilka minut.');
      } else if (err instanceof ApiError) {
        setError('Nie udało się utworzyć artykułu. Sprawdź dane wejściowe i spróbuj ponownie.');
      } else {
        setError('Wystąpił nieoczekiwany błąd.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <label htmlFor="topic" className="block text-sm font-medium text-gray-700">
          Temat artykułu
        </label>
        <input
          id="topic"
          name="topic"
          type="text"
          required
          minLength={5}
          maxLength={200}
          placeholder="np. Transformacja energetyczna w Polsce"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <p className="text-xs text-gray-500">Wpisz jedno konkretne zagadnienie w języku polskim (5-200 znaków).</p>
        {fieldErrors.topic ? <p className="text-sm text-red-600">{fieldErrors.topic}</p> : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="rubric_code" className="block text-sm font-medium text-gray-700">
          Rubryka
        </label>
        <select
          id="rubric_code"
          name="rubric_code"
          defaultValue=""
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Brak preferencji</option>
          {rubrics.map((rubric) => (
            <option key={rubric.code} value={rubric.code}>
              {rubric.name_pl}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">Opcjonalnie wybierz rubrykę, aby zawęzić ton i kontekst artykułu.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
          Słowa kluczowe
        </label>
        <input
          id="keywords"
          name="keywords"
          type="text"
          maxLength={480}
          placeholder="Oddziel słowa kluczowe przecinkami (maks. 6)"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <p className="text-xs text-gray-500">Dodaj maksymalnie 6 haseł (do 80 znaków każde), aby doprecyzować oczekiwane zagadnienia.</p>
        {fieldErrors.keywords ? <p className="text-sm text-red-600">{fieldErrors.keywords}</p> : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="guidance" className="block text-sm font-medium text-gray-700">
          Dodatkowe wskazówki
        </label>
        <textarea
          id="guidance"
          name="guidance"
          maxLength={500}
          rows={4}
          placeholder="Podaj dodatkowe wymagania dotyczące tonu, źródeł lub struktury (maks. 500 znaków)."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {fieldErrors.guidance ? <p className="text-sm text-red-600">{fieldErrors.guidance}</p> : null}
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Generowanie…' : 'Wygeneruj artykuł'}
        </button>
      </div>
    </form>
  );
}
