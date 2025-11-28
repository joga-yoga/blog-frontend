'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createArticle, ApiError, ServiceUnavailableError } from '@/lib/api/client';
import { articleCreateRequestSchema, type ArticleCreateRequest, type Rubric } from '@/lib/api/types';

type ArticleGeneratorFormProps = {
  rubrics: Rubric[];
};

type FieldErrors = Partial<Record<'topic' | 'keywords' | 'guidance' | 'video_url', string>>;

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

export function ArticleGeneratorForm({ rubrics }: ArticleGeneratorFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVideoUrl = useMemo(() => searchParams?.get('video_url') ?? '', [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);

  const normalizedVideoUrl = videoUrl.trim();
  const isVideoBased = Boolean(normalizedVideoUrl);

  const videoUrlWarning = useMemo(() => {
    if (!normalizedVideoUrl) {
      return null;
    }

    try {
      const parsed = new URL(normalizedVideoUrl);
      if (!parsed.protocol.startsWith('http')) {
        return 'Adres URL powinien zaczynać się od http(s).';
      }
    } catch {
      return 'To nie wygląda na poprawny adres URL. Upewnij się, że wklejono pełny link do wideo.';
    }

    return null;
  }, [normalizedVideoUrl]);

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
      rubric_code: rubricCode || null,
      keywords: parseKeywords(keywordsRaw),
      guidance: guidanceRaw.trim() ? guidanceRaw.trim() : null,
      video_url: normalizedVideoUrl || undefined
    };

    const validation = articleCreateRequestSchema.safeParse(payload);

    if (!validation.success) {
      const { fieldErrors: validationErrors } = validation.error.flatten();
      setFieldErrors({
        topic: validationErrors.topic?.[0],
        keywords: validationErrors.keywords?.[0],
        guidance: validationErrors.guidance?.[0],
        video_url: validationErrors.video_url?.[0]
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
      if (err instanceof ServiceUnavailableError || (err instanceof ApiError && err.status >= 500)) {
        setError('Generowanie artykułu jest chwilowo niedostępne. Spróbuj ponownie za kilka minut.');
      } else if (err instanceof ApiError) {
        const message =
          (typeof err.body === 'object' && err.body && 'detail' in err.body && typeof err.body.detail === 'string'
            ? err.body.detail
            : null) ||
          (typeof err.body === 'object' && err.body && 'message' in err.body && typeof err.body.message === 'string'
            ? err.body.message
            : null) ||
          (typeof err.body === 'string' && err.body.trim() ? err.body.trim() : null);

        if (err.status === 422) {
          const transcriptUnavailable = (message ?? '').toLowerCase().includes('transcript');
          setError(
            transcriptUnavailable
              ? 'To wideo nie ma transkrypcji lub nie jest ona dostępna. Wybierz inne wideo lub spróbuj ponownie później.'
              : message ?? 'Nie udało się utworzyć artykułu. Sprawdź dane wejściowe i spróbuj ponownie.'
          );
          setFieldErrors((previous) => ({ ...previous, video_url: message ?? previous.video_url }));
        } else {
          setError(message ?? 'Nie udało się utworzyć artykułu. Sprawdź dane wejściowe i spróbuj ponownie.');
        }
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
        <label htmlFor="video_url" className="block text-sm font-medium text-gray-700">
          Źródło wideo (opcjonalnie)
        </label>
        <input
          id="video_url"
          name="video_url"
          type="url"
          value={videoUrl}
          onChange={(event) => setVideoUrl(event.target.value)}
          maxLength={2048}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          disabled={isSubmitting}
        />
        <p className="text-xs text-gray-500">Podaj pełny link do filmu. Jeśli zostawisz puste, artykuł zostanie wygenerowany na podstawie tematu.</p>
        {videoUrlWarning ? <p className="text-sm text-amber-600">{videoUrlWarning}</p> : null}
        {fieldErrors.video_url ? <p className="text-sm text-red-600">{fieldErrors.video_url}</p> : null}
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
          {isSubmitting
            ? isVideoBased
              ? 'Pobieranie transkrypcji i generowanie…'
              : 'Generowanie…'
            : isVideoBased
              ? 'Wygeneruj z wideo'
              : 'Wygeneruj artykuł'}
        </button>
      </div>
    </form>
  );
}
