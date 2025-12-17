'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { createArticle, ApiError, ServiceUnavailableError } from '@/lib/api/client';
import {
  articleCreateRequestSchema,
  type ArticleCreateRequest,
  type ArticlePublishResponse,
  type Rubric
} from '@/lib/api/types';

type GeneratorMode = 'topic' | 'youtube';

type ArticleGeneratorFormProps = {
  rubrics: Rubric[];
};

type FieldErrors = Partial<Record<'topic' | 'keywords' | 'guidance' | 'video_url', string>>;

type GenerationHistoryItem = {
  id: string;
  timestamp: number;
  mode: GeneratorMode;
  label: string;
  slug: string;
};

const HISTORY_STORAGE_KEY = 'article-generator-history';

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

function extractVideoLabel(videoUrl: string): string {
  if (!videoUrl) return '';

  try {
    const parsed = new URL(videoUrl);
    const queryId = parsed.searchParams.get('v');
    if (queryId) {
      return queryId;
    }

    const path = parsed.pathname.split('/').filter(Boolean);
    if (path.length > 0) {
      return path[path.length - 1];
    }

    return parsed.host;
  } catch {
    return videoUrl.slice(0, 80);
  }
}

function formatHistoryItem(item: GenerationHistoryItem) {
  const formatter = new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  });

  return formatter.format(item.timestamp);
}

function loadHistory(): GenerationHistoryItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GenerationHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.slug === 'string');
  } catch {
    return [];
  }
}

function persistHistory(items: GenerationHistoryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Swallow storage errors silently to avoid breaking the UI.
  }
}

function RecentGenerations({
  history,
  onClear
}: {
  history: GenerationHistoryItem[];
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
        Brak zapisanych generacji. Nowe artykuły pojawią się tutaj po ukończeniu.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Ostatnie generacje</h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-gray-600 underline decoration-gray-400 underline-offset-4 hover:text-gray-900"
        >
          Wyczyść historię
        </button>
      </div>

      <ul className="space-y-3 text-sm text-gray-700">
        {history.map((entry) => (
          <li key={entry.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="rounded-full bg-gray-200 px-2 py-0.5 font-medium text-gray-700">
                {entry.mode === 'topic' ? 'Temat' : 'YouTube'}
              </span>
              <span aria-hidden="true">•</span>
              <span>{formatHistoryItem(entry)}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-gray-800">{entry.label}</p>
            <a
              className="mt-2 inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900"
              href={`/artykuly/${entry.slug}`}
            >
              Otwórz artykuł
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ArticleGeneratorForm({ rubrics }: ArticleGeneratorFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVideoUrl = useMemo(() => searchParams?.get('video_url') ?? '', [searchParams]);

  const [mode, setMode] = useState<GeneratorMode>(initialVideoUrl ? 'youtube' : 'topic');

  const [topicForm, setTopicForm] = useState({
    topic: '',
    guidance: '',
    keywords: '',
    rubric_code: '',
    video_url: ''
  });

  const [youtubeForm, setYoutubeForm] = useState({
    topic: '',
    video_url: initialVideoUrl,
    guidance: '',
    keywords: '',
    rubric_code: ''
  });

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [rawResultVisible, setRawResultVisible] = useState(false);
  const [successResult, setSuccessResult] = useState<ArticlePublishResponse | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const currentForm = mode === 'topic' ? topicForm : youtubeForm;
  const isSubmitting = status === 'submitting';

  const videoUrlWarning = useMemo(() => {
    if (!currentForm.video_url?.trim()) {
      return null;
    }

    try {
      const parsed = new URL(currentForm.video_url.trim());
      if (!parsed.protocol.startsWith('http')) {
        return 'Adres URL powinien zaczynać się od http(s).';
      }
    } catch {
      return 'To nie wygląda na poprawny adres URL. Upewnij się, że wklejono pełny link do wideo.';
    }

    return null;
  }, [currentForm.video_url]);

  function updateHistory(newItem: GenerationHistoryItem) {
    setHistory((previous) => {
      const next = [newItem, ...previous].slice(0, 10);
      persistHistory(next);
      return next;
    });
  }

  function clearHistory() {
    persistHistory([]);
    setHistory([]);
  }

  function resolveTopic(): string {
    const trimmedTopic = (mode === 'topic' ? topicForm.topic : youtubeForm.topic).trim();
    if (trimmedTopic) return trimmedTopic;

    const videoLabel = mode === 'youtube' ? extractVideoLabel(youtubeForm.video_url) : '';
    const fallback = `Artykuł na podstawie wideo ${videoLabel || 'YouTube'}`.slice(0, 200);
    return fallback.length >= 5 ? fallback : 'Artykuł na podstawie YouTube';
  }

  function handleModeChange(nextMode: GeneratorMode) {
    setMode(nextMode);
    setFieldErrors({});
    setStatus('idle');
    setErrorMessage(null);
    setErrorDetails(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const topic = mode === 'topic' ? topicForm.topic.trim() : resolveTopic();
    const rubricCode = (currentForm.rubric_code ?? '').trim();
    const keywordsRaw = currentForm.keywords ?? '';
    const guidanceRaw = currentForm.guidance ?? '';
    const normalizedVideoUrl = currentForm.video_url?.trim() ?? '';

    const payload: ArticleCreateRequest = {
      topic,
      rubric_code: rubricCode || null,
      keywords: parseKeywords(keywordsRaw),
      guidance: guidanceRaw.trim() ? guidanceRaw.trim() : null,
      video_url: mode === 'youtube' ? normalizedVideoUrl || null : null
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
      setStatus('error');
      setErrorMessage('Popraw zaznaczone pola i spróbuj ponownie.');
      return;
    }

    if (mode === 'youtube' && !normalizedVideoUrl) {
      setFieldErrors((previous) => ({ ...previous, video_url: 'Wklej link do wideo, aby wygenerować artykuł.' }));
      setStatus('error');
      setErrorMessage('Nie podano linku do wideo.');
      return;
    }

    setStatus('submitting');
    setErrorMessage(null);
    setErrorDetails(null);
    setFieldErrors({});
    setCopyFeedback(null);

    try {
      const result = await createArticle(validation.data);
      setSuccessResult(result);
      setStatus('success');

      const historyItem: GenerationHistoryItem = {
        id: `${Date.now()}-${result.slug}`,
        timestamp: Date.now(),
        mode,
        label: mode === 'topic' ? topic : extractVideoLabel(normalizedVideoUrl) || normalizedVideoUrl,
        slug: result.slug
      };
      updateHistory(historyItem);

      router.prefetch(`/artykuly/${result.slug}`);
    } catch (err) {
      setStatus('error');
      if (err instanceof ServiceUnavailableError || (err instanceof ApiError && err.status >= 500)) {
        setErrorMessage('Generowanie artykułu jest chwilowo niedostępne. Spróbuj ponownie za kilka minut.');
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
          setErrorMessage(
            transcriptUnavailable
              ? 'To wideo nie ma transkrypcji lub nie jest ona dostępna. Wybierz inne wideo lub spróbuj ponownie później.'
              : message ?? 'Nie udało się utworzyć artykułu. Sprawdź dane wejściowe i spróbuj ponownie.'
          );
          setFieldErrors((previous) => ({ ...previous, video_url: message ?? previous.video_url }));
        } else {
          setErrorMessage(message ?? 'Nie udało się utworzyć artykułu. Sprawdź dane wejściowe i spróbuj ponownie.');
        }

        setErrorDetails(typeof err.body === 'object' ? JSON.stringify(err.body, null, 2) : null);
      } else {
        setErrorMessage('Wystąpił nieoczekiwany błąd.');
      }
    }
  }

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback(`${label} skopiowano do schowka.`);
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      setCopyFeedback('Nie udało się skopiować. Skopiuj ręcznie.');
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  }

  const rubricsAvailable = Array.isArray(rubrics) && rubrics.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="space-y-6">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 p-1 text-sm font-semibold text-gray-700">
          {(
            [
              { key: 'topic', label: 'Temat' },
              { key: 'youtube', label: 'YouTube' }
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleModeChange(option.key)}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                mode === option.key ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">Stan: {status === 'submitting' ? 'Generowanie…' : status === 'success' ? 'Gotowe' : status === 'error' ? 'Błąd' : 'Oczekiwanie'}</span>
            {copyFeedback ? <span className="text-green-700">{copyFeedback}</span> : null}
          </div>

          {mode === 'topic' ? (
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
                value={topicForm.topic}
                onChange={(event) =>
                  setTopicForm((previous) => ({ ...previous, topic: event.target.value }))
                }
                placeholder="np. Transformacja energetyczna w Polsce"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">Wpisz jedno konkretne zagadnienie w języku polskim (5-200 znaków).</p>
              {fieldErrors.topic ? <p className="text-sm text-red-600">{fieldErrors.topic}</p> : null}
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="video_url" className="block text-sm font-medium text-gray-700">
                Link do YouTube
              </label>
              <input
                id="video_url"
                name="video_url"
                type="url"
                value={youtubeForm.video_url}
                onChange={(event) =>
                  setYoutubeForm((previous) => ({ ...previous, video_url: event.target.value }))
                }
                maxLength={2048}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                disabled={isSubmitting}
                required
              />
              <p className="text-xs text-gray-500">Wklej pełny link do filmu. To pole jest wymagane w trybie YouTube.</p>
              {videoUrlWarning ? <p className="text-sm text-amber-600">{videoUrlWarning}</p> : null}
              {fieldErrors.video_url ? <p className="text-sm text-red-600">{fieldErrors.video_url}</p> : null}

              <div className="space-y-2">
                <label htmlFor="youtube_topic" className="block text-sm font-medium text-gray-700">
                  Temat artykułu (opcjonalnie)
                </label>
                <input
                  id="youtube_topic"
                  name="topic"
                  type="text"
                  maxLength={200}
                  value={youtubeForm.topic}
                  onChange={(event) =>
                    setYoutubeForm((previous) => ({ ...previous, topic: event.target.value }))
                  }
                  placeholder="Jeśli puste, temat zostanie określony na podstawie wideo"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">Użyj, jeśli chcesz narzucić konkretny temat. W przeciwnym razie zostanie przygotowany automatycznie.</p>
                {fieldErrors.topic ? <p className="text-sm text-red-600">{fieldErrors.topic}</p> : null}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="guidance" className="block text-sm font-medium text-gray-700">
              Dodatkowe wskazówki
            </label>
            <textarea
              id="guidance"
              name="guidance"
              maxLength={500}
              rows={4}
              value={currentForm.guidance}
              onChange={(event) =>
                mode === 'topic'
                  ? setTopicForm((previous) => ({ ...previous, guidance: event.target.value }))
                  : setYoutubeForm((previous) => ({ ...previous, guidance: event.target.value }))
              }
              placeholder="Dodatkowe wskazówki co do stylu/tonu, źródeł lub struktury (maks. 500 znaków)."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={isSubmitting}
            />
            {fieldErrors.guidance ? <p className="text-sm text-red-600">{fieldErrors.guidance}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
              Słowa kluczowe (oddziel przecinkami)
            </label>
            <input
              id="keywords"
              name="keywords"
              type="text"
              maxLength={480}
              value={currentForm.keywords}
              onChange={(event) =>
                mode === 'topic'
                  ? setTopicForm((previous) => ({ ...previous, keywords: event.target.value }))
                  : setYoutubeForm((previous) => ({ ...previous, keywords: event.target.value }))
              }
              placeholder="np. zielona energia, OZE, bezpieczeństwo energetyczne"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500">Słowa kluczowe (oddziel przecinkami). Maksymalnie 6 haseł, do 80 znaków każde.</p>
            {fieldErrors.keywords ? <p className="text-sm text-red-600">{fieldErrors.keywords}</p> : null}
          </div>

          {rubricsAvailable ? (
            <div className="space-y-2">
              <label htmlFor="rubric_code" className="block text-sm font-medium text-gray-700">
                Rubryka
              </label>
              <select
                id="rubric_code"
                name="rubric_code"
                value={currentForm.rubric_code}
                onChange={(event) =>
                  mode === 'topic'
                    ? setTopicForm((previous) => ({ ...previous, rubric_code: event.target.value }))
                    : setYoutubeForm((previous) => ({ ...previous, rubric_code: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                disabled={isSubmitting}
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
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Rubryki nie są teraz dostępne. Formularz nadal działa – rubryka jest opcjonalna.
            </div>
          )}

          {errorMessage ? (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p>{errorMessage}</p>
              {errorDetails ? (
                <details className="text-xs text-red-600">
                  <summary className="cursor-pointer font-semibold">Szczegóły</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-[11px]">{errorDetails}</pre>
                </details>
              ) : null}
            </div>
          ) : null}

          {successResult ? (
            <div className="space-y-3 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Sukces</span>
                <span>Artykuł wygenerowany.</span>
              </div>
              <p className="font-semibold text-green-900">Slug: {successResult.slug}</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`/artykuly/${successResult.slug}`}
                  className="inline-flex items-center rounded-md bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-green-800"
                >
                  Otwórz artykuł
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(successResult.slug, 'Slug')}
                  className="inline-flex items-center rounded-md border border-green-300 px-3 py-2 text-xs font-semibold text-green-800 transition hover:bg-green-100"
                >
                  Kopiuj slug
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(`${window.location.origin}/artykuly/${successResult.slug}`, 'Link')}
                  className="inline-flex items-center rounded-md border border-green-300 px-3 py-2 text-xs font-semibold text-green-800 transition hover:bg-green-100"
                >
                  Kopiuj link
                </button>
                <button
                  type="button"
                  onClick={() => setRawResultVisible((visible) => !visible)}
                  className="inline-flex items-center rounded-md border border-green-300 px-3 py-2 text-xs font-semibold text-green-800 transition hover:bg-green-100"
                >
                  {rawResultVisible ? 'Ukryj JSON' : 'Pokaż JSON'}
                </button>
              </div>
              {rawResultVisible ? (
                <pre className="max-h-64 overflow-auto rounded-md bg-white p-3 text-[11px] text-gray-800">
                  {JSON.stringify(successResult, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Generowanie…' : 'Generuj'}
            </button>
          </div>
        </form>
      </div>

      <RecentGenerations history={history} onClear={clearHistory} />
    </div>
  );
}
