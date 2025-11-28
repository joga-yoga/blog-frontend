"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

class AdminApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

type SearchType = "video" | "channel" | "playlist" | "movie";
type SearchDuration = "short" | "medium" | "long";
type SearchFeature = "subtitles" | "location";

type SearchFormState = {
  query: string;
  limit: string;
  type: SearchType;
  duration: SearchDuration;
  features: SearchFeature[];
};

type SearchResultItem = {
  videoId: string | null;
  url: string;
  title: string;
  channel: string;
  durationSeconds: number | null;
  publishedAt: string | null;
  descriptionSnippet: string;
};

type StatusSummary = {
  pending: number;
  running: number;
  done: number;
  skipped: number;
  failed: number;
  runner_on: boolean;
};

type QueueEntry = {
  url: string;
  status: string;
  plannedAt: string | null;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

type ApiFetchOptions = {
  method?: string;
  body?: unknown;
};

function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof AdminApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}

function extractChannelName(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed) {
    return "Unknown channel";
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const normalized = trimmed.replace(/'/g, '"');

    try {
      const parsed = JSON.parse(normalized);

      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const candidate = [record.name, record.title, record.channel]
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .find((value) => value);

        if (candidate) {
          return candidate;
        }
      }
    } catch (error) {
      const match = trimmed.match(/name["']?\s*[:=]\s*["']([^"'}]+)["']/i);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    const fallbackMatch = trimmed.match(/"?name"?\s*[:=]\s*"?([^"'}]+)"?/i);
    if (fallbackMatch?.[1]) {
      return fallbackMatch[1].trim();
    }
  }

  return trimmed;
}

const isItemSelectable = (item: SearchResultItem) => Boolean(item.url && item.videoId);

function formatDuration(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "--";
  }

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hoursPart = hours > 0 ? `${hours.toString().padStart(2, "0")}:` : "";
  return `${hoursPart}${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ").slice(0, 16);
  }

  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function normalizeQueueResponse(data: unknown): QueueEntry[] {
  const rawItems: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown[] }).items)
      ? ((data as { items?: unknown[] }).items ?? [])
      : [];

  return rawItems
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : "";

      if (!url) {
        return null;
      }

      const status = typeof record.status === "string" ? record.status : "unknown";
      const plannedAt = typeof record.planned_at === "string" ? record.planned_at : null;

      return {
        url,
        status,
        plannedAt,
      } satisfies QueueEntry;
    })
    .filter((entry): entry is QueueEntry => Boolean(entry));
}

export function normalizeSearchResults(data: unknown): SearchResultItem[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const items = Array.isArray((data as { items?: unknown[] }).items)
    ? ((data as { items?: unknown[] }).items ?? [])
    : [];

  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : "";

      if (!url) {
        return null;
      }

      const title = typeof record.title === "string" && record.title.trim() ? record.title : "Untitled video";
      const rawChannel = typeof record.channel === "string" ? record.channel : "";
      const channel = rawChannel ? extractChannelName(rawChannel) : "Unknown channel";
      const durationSeconds = typeof record.duration_seconds === "number" ? record.duration_seconds : null;
      const publishedAt = typeof record.published_at === "string" ? record.published_at : null;
      const descriptionSnippet =
        typeof record.description_snippet === "string" ? record.description_snippet : "";
      const videoId = typeof record.video_id === "string" && record.video_id.trim() ? record.video_id : null;

      return {
        videoId,
        url,
        title,
        channel,
        durationSeconds,
        publishedAt,
        descriptionSnippet,
      } satisfies SearchResultItem;
    })
    .filter((item): item is SearchResultItem => Boolean(item));
}

type ParseNumberOptions = {
  min?: number;
  max?: number;
};

function parseNumberOrFallback(value: string, fallback: number, options: ParseNumberOptions = {}): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const { min, max } = options;
  let normalized = parsed;

  if (typeof min === "number" && Number.isFinite(min)) {
    normalized = Math.max(normalized, min);
  }

  if (typeof max === "number" && Number.isFinite(max)) {
    normalized = Math.min(normalized, max);
  }

  return normalized;
}

const SEARCH_TYPES: SearchType[] = ["video", "channel", "playlist", "movie"];
const SEARCH_DURATIONS: SearchDuration[] = ["short", "medium", "long"];
const SEARCH_FEATURES: SearchFeature[] = ["subtitles", "location"];

const INITIAL_FORM_STATE: SearchFormState = {
  query: "",
  limit: "5",
  type: "video",
  duration: "medium",
  features: [],
};

const AdminAppPage = () => {
  const [apiBaseUrl, setApiBaseUrl] = useState<string | null>(null);
  const [apiBaseUrlError, setApiBaseUrlError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  const [formState, setFormState] = useState<SearchFormState>(INITIAL_FORM_STATE);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<Feedback | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(() => new Set());
  const [queuePlanFeedback, setQueuePlanFeedback] = useState<Feedback | null>(null);
  const [queuePlanLoading, setQueuePlanLoading] = useState(false);

  const [statusData, setStatusData] = useState<StatusSummary | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [controlsFeedback, setControlsFeedback] = useState<Feedback | null>(null);
  const [activeControl, setActiveControl] = useState<"start" | "stop" | "clear" | "generate" | null>(null);

  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueSupported, setQueueSupported] = useState(true);

  const [searchPanelOpen, setSearchPanelOpen] = useState(true);

  useEffect(() => {
    const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!rawBaseUrl) {
      setApiBaseUrlError("Environment variable NEXT_PUBLIC_API_BASE_URL is not configured.");
      return;
    }

    try {
      const parsed = new URL(rawBaseUrl);
      const normalized = `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
      setApiBaseUrl(normalized);
    } catch (error) {
      setApiBaseUrlError(
        `Environment variable NEXT_PUBLIC_API_BASE_URL must be a valid absolute URL. Received: "${rawBaseUrl}".`
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get("t");

    setToken(rawToken && rawToken.trim() ? rawToken.trim() : null);
    setTokenChecked(true);
  }, []);

  const apiFetch = useCallback(
    async <TResponse,>(path: string, options: ApiFetchOptions = {}): Promise<TResponse> => {
      if (!apiBaseUrl) {
        throw new AdminApiError("API base URL is not configured.");
      }

      if (!token) {
        throw new AdminApiError("Admin token is missing.");
      }

      const { method = "GET", body } = options;
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const url = `${apiBaseUrl}${normalizedPath}`;
      const headers = new Headers();
      headers.set("Accept", "application/json");
      headers.set("X-Admin-Token", token);
      headers.set("Content-Type", "application/json");

      const init: RequestInit = {
        method,
        headers,
      };

      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      let response: Response;

      try {
        response = await fetch(url, init);
      } catch (error) {
        throw new AdminApiError("Network request failed.");
      }

      const contentType = response.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      let payload: unknown = null;

      if (isJson) {
        payload = await response.json().catch(() => null);
      } else {
        const text = await response.text().catch(() => "");
        payload = text || null;
      }

      if (!response.ok) {
        const message =
          (payload && typeof payload === "object" && "detail" in payload && typeof (payload as { detail?: unknown }).detail === "string"
            ? (payload as { detail?: string }).detail
            : undefined) ||
          (payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message?: string }).message
            : undefined) ||
          (typeof payload === "string" && payload) ||
          `Request failed with status ${response.status}`;

        throw new AdminApiError(message, response.status);
      }

      return (payload ?? null) as TResponse;
    },
    [apiBaseUrl, token]
  );

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);

    try {
      const data = await apiFetch<StatusSummary>("/admin/status");
      setStatusData(data);
    } catch (error) {
      setStatusError(getErrorMessage(error));
    } finally {
      setStatusLoading(false);
    }
  }, [apiFetch]);

  const refreshQueue = useCallback(async () => {
    if (!queueSupported) {
      return;
    }

    setQueueLoading(true);
    setQueueError(null);

    try {
      const data = await apiFetch<unknown>("/admin/queue");
      setQueueEntries(normalizeQueueResponse(data).slice(0, 20));
      setQueueSupported(true);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 404) {
        setQueueSupported(false);
      } else {
        setQueueError(getErrorMessage(error));
      }
    } finally {
      setQueueLoading(false);
    }
  }, [apiFetch, queueSupported]);

  useEffect(() => {
    if (!token || !apiBaseUrl) {
      return;
    }

    void refreshStatus();
    void refreshQueue();
  }, [apiBaseUrl, token, refreshQueue, refreshStatus]);

  useEffect(() => {
    setSelectedUrls((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const next = new Set<string>();

      for (const item of searchResults) {
        if (previous.has(item.url) && isItemSelectable(item)) {
          next.add(item.url);
        }
      }

      if (next.size === previous.size) {
        return previous;
      }

      return next;
    });
  }, [searchResults]);

  const selectableResults = useMemo(
    () => searchResults.filter((item) => isItemSelectable(item)),
    [searchResults]
  );

  const resultUrls = useMemo(() => {
    const seen = new Set<string>();
    const urls: string[] = [];

    for (const item of searchResults) {
      if (item.url && !seen.has(item.url)) {
        seen.add(item.url);
        urls.push(item.url);
      }
    }

    return urls;
  }, [searchResults]);

  const selectedItems = useMemo(
    () => selectableResults.filter((item) => selectedUrls.has(item.url)),
    [selectableResults, selectedUrls]
  );

  const allResultsSelected = useMemo(
    () => selectableResults.length > 0 && selectedItems.length === selectableResults.length,
    [selectableResults.length, selectedItems.length]
  );

  const selectedCount = selectedItems.length;

  const handleInputChange = (field: "query" | "limit") => (event: ChangeEvent<HTMLInputElement>) => {
    setFormState((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as SearchType;
    setFormState((previous) => ({
      ...previous,
      type: SEARCH_TYPES.includes(value) ? value : "video",
    }));
  };

  const handleDurationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as SearchDuration;
    setFormState((previous) => ({
      ...previous,
      duration: SEARCH_DURATIONS.includes(value) ? value : "medium",
    }));
  };

  const toggleFeature = (feature: SearchFeature) => {
    setFormState((previous) => {
      const hasFeature = previous.features.includes(feature);
      const nextFeatures = hasFeature
        ? previous.features.filter((item) => item !== feature)
        : [...previous.features, feature];

      return {
        ...previous,
        features: nextFeatures.filter((item): item is SearchFeature => SEARCH_FEATURES.includes(item)),
      };
    });
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.query.trim()) {
      setSearchError("Please enter a query before searching.");
      setSearchFeedback(null);
      setSearchAttempted(true);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchFeedback(null);
    setSearchAttempted(true);

    const sanitizedType = SEARCH_TYPES.includes(formState.type) ? formState.type : "video";
    const sanitizedDuration = SEARCH_DURATIONS.includes(formState.duration) ? formState.duration : "medium";
    const sanitizedFeatures = formState.features.filter((feature): feature is SearchFeature =>
      SEARCH_FEATURES.includes(feature)
    );

    const payload = {
      query: formState.query.trim(),
      limit: parseNumberOrFallback(formState.limit, 5, { min: 1, max: 100 }),
      type: sanitizedType,
      duration: sanitizedDuration,
      features: sanitizedFeatures,
    };

    try {
      const data = await apiFetch<unknown>("/admin/search", { method: "POST", body: payload });
      const items = normalizeSearchResults(data);
      setSearchResults(items);
      setSelectedUrls(new Set());

      if (items.length === 0) {
        setSearchFeedback(null);
      } else {
        setSearchFeedback({ type: "success", message: `Found ${items.length} result${items.length === 1 ? "" : "s"}.` });
      }
    } catch (error) {
      setSearchError(getErrorMessage(error));
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedUrls(new Set());
      return;
    }

    if (selectableResults.length === 0) {
      setSelectedUrls(new Set());
      return;
    }

    setSelectedUrls(new Set(selectableResults.map((item) => item.url)));
  };

  const toggleSelection = (url: string, checked: boolean) => {
    const selectableItem = searchResults.find((item) => item.url === url && isItemSelectable(item));

    setSelectedUrls((previous) => {
      if (checked) {
        if (!selectableItem || previous.has(url)) {
          return previous;
        }

        const next = new Set(previous);
        next.add(url);
        return next;
      }

      if (!previous.has(url)) {
        return previous;
      }

      const next = new Set(previous);
      next.delete(url);
      return next;
    });
  };

  const handleAddToQueue = async () => {
    if (selectedCount === 0) {
      setQueuePlanFeedback({ type: "error", message: "Select at least one video to queue." });
      return;
    }

    const urls = Array.from(new Set(selectedItems.map((item) => item.url).filter(Boolean)));

    if (urls.length === 0) {
      setQueuePlanFeedback({ type: "error", message: "No valid videos selected for queueing." });
      return;
    }

    setQueuePlanLoading(true);
    setQueuePlanFeedback(null);

    try {
      await apiFetch("/admin/queue/plan", {
        method: "POST",
        body: { urls },
      });

      const total = urls.length;
      setQueuePlanFeedback({
        type: "success",
        message: `Queued ${total} item${total === 1 ? "" : "s"}.`,
      });
      setSelectedUrls(new Set());
      await refreshQueue();
      await refreshStatus();
    } catch (error) {
      setQueuePlanFeedback({ type: "error", message: getErrorMessage(error) });
    } finally {
      setQueuePlanLoading(false);
    }
  };

  const runControlAction = async (action: "start" | "stop" | "clear", request: () => Promise<void>) => {
    setActiveControl(action);
    setControlsFeedback(null);

    try {
      await request();
      setControlsFeedback({ type: "success", message: "Action completed successfully." });
      await refreshStatus();
      if (action === "clear") {
        await refreshQueue();
      }
    } catch (error) {
      setControlsFeedback({ type: "error", message: getErrorMessage(error) });
    } finally {
      setActiveControl(null);
    }
  };

  const handleStart = () => {
    void runControlAction("start", async () => {
      await apiFetch("/admin/run/start", { method: "POST" });
    });
  };

  const handleStop = () => {
    void runControlAction("stop", async () => {
      await apiFetch("/admin/run/stop", { method: "POST" });
    });
  };

  const handleClear = () => {
    void runControlAction("clear", async () => {
      await apiFetch("/admin/queue/clear", { method: "POST" });
      setQueueEntries([]);
    });
  };

  const handleGenerateNow = () => {
    if (selectedCount !== 1) {
      return;
    }

    const url = selectedItems[0]?.url;

    if (!url) {
      return;
    }

    setActiveControl("generate");
    setControlsFeedback(null);

    void (async () => {
      try {
        const response = await apiFetch<{ accepted: boolean; article_id?: number; reason?: string }>(
          "/admin/generate_now",
          { method: "POST", body: { url } }
        );

        if (response?.accepted) {
          const articleId =
            typeof response.article_id === "number" && Number.isFinite(response.article_id)
              ? response.article_id
              : null;
          setControlsFeedback({
            type: "success",
            message: articleId
              ? `Generation accepted. Article #${articleId}.`
              : "Generation accepted.",
          });
        } else {
          const reason = typeof response?.reason === "string" && response.reason.trim() ? response.reason.trim() : null;
          setControlsFeedback({
            type: "error",
            message: reason ? `Generate request rejected: ${reason}` : "Generate request was not accepted.",
          });
        }

        await refreshStatus();
        await refreshQueue();
      } catch (error) {
        setControlsFeedback({ type: "error", message: getErrorMessage(error) });
      } finally {
        setActiveControl(null);
      }
    })();
  };

  if (apiBaseUrlError) {
    return (
      <main className="min-h-screen w-full bg-slate-50 px-6 py-6">
        <div className="w-full rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          <h1 className="text-lg font-semibold">Configuration error</h1>
          <p className="mt-2 text-sm leading-6">{apiBaseUrlError}</p>
        </div>
      </main>
    );
  }

  if (!tokenChecked) {
    return (
      <main className="min-h-screen w-full bg-slate-50 px-6 py-6">
        <div className="text-sm text-slate-600">Loading…</div>
      </main>
    );
  }

  if (!token) {
    const loginUrl = apiBaseUrl ? `${apiBaseUrl}/admin` : process.env.NEXT_PUBLIC_API_BASE_URL ?? "/admin";

    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">No token provided</h1>
          <p className="mt-2 text-sm text-slate-600">
            Please login at Admin to obtain a token.
          </p>
          <div className="mt-6">
            <Link
              href={loginUrl}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              Go to Admin login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-slate-50 px-6 py-6">
      <div className="flex w-full flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Auto-Generator Console</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage discovery results, publishing queue, and runner status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label="Runner"
              value={statusData ? (statusData.runner_on ? "ON" : "OFF") : "--"}
              tone={statusData?.runner_on ? "success" : "default"}
            />
            <StatusPill label="Pending" value={statusData ? String(statusData.pending) : "--"} />
            <StatusPill label="Running" value={statusData ? String(statusData.running) : "--"} />
            <StatusPill label="Done" value={statusData ? String(statusData.done) : "--"} />
            <StatusPill label="Skipped" value={statusData ? String(statusData.skipped) : "--"} />
            <StatusPill label="Failed" value={statusData ? String(statusData.failed) : "--"} />
            <button
              type="button"
              onClick={() => {
                void refreshStatus();
                void refreshQueue();
              }}
              disabled={statusLoading}
              className="ml-2 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statusLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        {statusError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            {statusError}
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Search videos</h2>
            <button
              type="button"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
              onClick={() => setSearchPanelOpen((previous) => !previous)}
            >
              {searchPanelOpen ? "Collapse" : "Expand"}
            </button>
          </header>
          {searchPanelOpen ? (
            <div className="px-6 pb-6 pt-4">
              <form onSubmit={handleSearch} className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Search query</span>
                    <input
                      type="text"
                      value={formState.query}
                      onChange={handleInputChange("query")}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. yoga for spine"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Limit (default 5)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formState.limit}
                      onChange={handleInputChange("limit")}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Type</span>
                    <select
                      value={formState.type}
                      onChange={handleTypeChange}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      {SEARCH_TYPES.map((searchType) => (
                        <option key={searchType} value={searchType}>
                          {searchType.charAt(0).toUpperCase() + searchType.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Duration</span>
                    <select
                      value={formState.duration}
                      onChange={handleDurationChange}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="short">Short (&lt;4 min)</option>
                      <option value="medium">Medium (4–20 min)</option>
                      <option value="long">Long (&gt;20 min)</option>
                    </select>
                  </label>
                  <fieldset className="flex flex-col gap-2 text-sm">
                    <legend className="font-medium text-slate-700">Features</legend>
                    <div className="flex flex-col gap-2">
                      {SEARCH_FEATURES.map((feature) => {
                        const id = `feature-${feature}`;
                        return (
                          <label key={feature} htmlFor={id} className="flex items-center gap-2 text-slate-700">
                            <input
                              id={id}
                              type="checkbox"
                              checked={formState.features.includes(feature)}
                              onChange={() => toggleFeature(feature)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="capitalize">{feature}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={searchLoading}
                  >
                    {searchLoading ? "Searching…" : "Search"}
                  </button>
                  {searchError ? (
                    <p className="text-sm text-red-600">Search failed: {searchError}</p>
                  ) : null}
                  {searchFeedback ? (
                    <p
                      className={`text-sm ${
                        searchFeedback.type === "success" ? "text-green-600" : "text-slate-600"
                      }`}
                    >
                      {searchFeedback.message}
                    </p>
                  ) : null}
                </div>
              </form>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Results</h2>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Found: {searchResults.length}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={allResultsSelected}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  disabled={selectableResults.length === 0}
                />
                Select all
              </label>
              <button
                type="button"
                onClick={handleAddToQueue}
                disabled={queuePlanLoading || selectableResults.length === 0 || selectedCount === 0}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {queuePlanLoading ? "Adding…" : "Add selected to queue"}
              </button>
            </div>
          </header>
          <div className="px-6 pb-6 pt-4">
            {queuePlanFeedback ? (
              <p
                className={`mb-3 text-sm ${
                  queuePlanFeedback.type === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {queuePlanFeedback.message}
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="w-12 border-b border-slate-200 px-3 py-2">Select</th>
                    <th className="w-24 border-b border-slate-200 px-3 py-2">Preview</th>
                    <th className="border-b border-slate-200 px-3 py-2">Title</th>
                    <th className="border-b border-slate-200 px-3 py-2">Channel</th>
                    <th className="border-b border-slate-200 px-3 py-2">Duration</th>
                    <th className="border-b border-slate-200 px-3 py-2">Published</th>
                    <th className="border-b border-slate-200 px-3 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                        {searchAttempted
                          ? "No results found."
                          : "Use the search above to find videos."}
                      </td>
                    </tr>
                  ) : (
                    searchResults.map((item) => {
                      const checked = selectedUrls.has(item.url);
                      const selectable = isItemSelectable(item);
                      return (
                        <tr key={item.url} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-3 align-top">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={checked}
                              onChange={(event) => toggleSelection(item.url, event.target.checked)}
                              disabled={!selectable}
                              aria-disabled={!selectable}
                            />
                          </td>
                          <td className="px-3 py-3 align-top">
                            {item.videoId ? (
                              <img
                                src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                                alt={item.title}
                                className="h-20 w-28 rounded-md border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-20 w-28 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-500">
                                No preview
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-slate-900 hover:text-blue-600"
                            >
                              {item.title}
                            </a>
                            <div className="mt-1 text-xs">
                              <Link
                                href={`/generator?video_url=${encodeURIComponent(item.url)}`}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                Use in generator
                              </Link>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top text-slate-700">{item.channel}</td>
                            <td className="px-3 py-3 align-top text-slate-700">{formatDuration(item.durationSeconds)}</td>
                            <td className="px-3 py-3 align-top text-slate-700">{formatDate(item.publishedAt)}</td>
                            <td className="px-3 py-3 align-top text-slate-600">
                              <p className="line-clamp-2 whitespace-pre-line">{item.descriptionSnippet || "—"}</p>
                            </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Queue controls</h2>
          </header>
          <div className="px-6 pb-6 pt-4">
            {controlsFeedback ? (
              <p
                className={`mb-4 text-sm ${
                  controlsFeedback.type === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {controlsFeedback.message}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleStart}
                disabled={activeControl !== null}
                className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeControl === "start" ? "Starting…" : "Start publishing"}
              </button>
              <button
                type="button"
                onClick={handleStop}
                disabled={activeControl !== null}
                className="inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeControl === "stop" ? "Stopping…" : "Stop"}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={activeControl !== null}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeControl === "clear" ? "Clearing…" : "Clear queue"}
              </button>
              <button
                type="button"
                onClick={handleGenerateNow}
                disabled={activeControl !== null || selectedCount !== 1}
                className="inline-flex items-center justify-center rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeControl === "generate" ? "Sending…" : "Generate now"}
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Publishing runs sequentially with 2–3h jitter, single worker.
            </p>
          </div>
        </section>

        {queueSupported ? (
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Queue</h2>
              <button
                type="button"
                onClick={() => {
                  void refreshQueue();
                }}
                disabled={queueLoading}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {queueLoading ? "Refreshing…" : "Refresh"}
              </button>
            </header>
            <div className="px-6 pb-6 pt-4">
              {queueError ? (
                <p className="mb-3 text-sm text-red-600">{queueError}</p>
              ) : null}
              {queueEntries.length === 0 ? (
                <p className="text-sm text-slate-500">No queue entries to display.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto border-collapse text-sm">
                    <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="border-b border-slate-200 px-3 py-2">URL</th>
                        <th className="border-b border-slate-200 px-3 py-2">Status</th>
                        <th className="border-b border-slate-200 px-3 py-2">Planned at (UTC)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueEntries.map((entry) => (
                        <tr key={`${entry.url}-${entry.plannedAt ?? "none"}`} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-3 align-top">
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noreferrer"
                              title={entry.url}
                              className="break-all text-slate-900 hover:text-blue-600"
                            >
                              {entry.url.length > 60
                                ? `${entry.url.slice(0, 30)}…${entry.url.slice(-20)}`
                                : entry.url}
                            </a>
                          </td>
                          <td className="px-3 py-3 align-top text-slate-700">{entry.status}</td>
                          <td className="px-3 py-3 align-top text-slate-700">{formatDateTime(entry.plannedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
};

type StatusPillProps = {
  label: string;
  value: string;
  tone?: "success" | "default";
};

const StatusPill = ({ label, value, tone = "default" }: StatusPillProps) => {
  const baseClasses =
    "inline-flex flex-col rounded-md border px-3 py-2 text-left text-xs font-medium shadow-sm min-w-[72px]";
  const toneClasses =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`${baseClasses} ${toneClasses}`}>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
};

export default AdminAppPage;
