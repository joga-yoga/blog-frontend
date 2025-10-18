"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

class AdminApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

type SearchFormState = {
  query: string;
  limit: string;
  minDuration: string;
  maxDuration: string;
};

type SearchResultItem = {
  videoId: string | null;
  url: string;
  title: string;
  channel: string;
  durationSeconds: number | null;
  publishedAt: string | null;
  descriptionSnippet: string;
  hasTranscript: boolean | null;
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

function normalizeSearchResults(data: unknown): SearchResultItem[] {
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
      const channel = typeof record.channel === "string" && record.channel.trim() ? record.channel : "Unknown channel";
      const durationSeconds = typeof record.duration_seconds === "number" ? record.duration_seconds : null;
      const publishedAt = typeof record.published_at === "string" ? record.published_at : null;
      const descriptionSnippet =
        typeof record.description_snippet === "string" ? record.description_snippet : "";
      const hasTranscriptRaw = record.has_transcript as unknown;
      const hasTranscript =
        typeof hasTranscriptRaw === "boolean"
          ? hasTranscriptRaw
          : hasTranscriptRaw === null
            ? null
            : null;
      const videoId = typeof record.video_id === "string" && record.video_id.trim() ? record.video_id : null;

      return {
        videoId,
        url,
        title,
        channel,
        durationSeconds,
        publishedAt,
        descriptionSnippet,
        hasTranscript,
      } satisfies SearchResultItem;
    })
    .filter((item): item is SearchResultItem => Boolean(item));
}

function parseIntOrFallback(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const INITIAL_FORM_STATE: SearchFormState = {
  query: "",
  limit: "50",
  minDuration: "600",
  maxDuration: "10800",
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

      const init: RequestInit = {
        method,
        headers,
      };

      if (body !== undefined) {
        headers.set("Content-Type", "application/json");
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
        if (previous.has(item.url)) {
          next.add(item.url);
        }
      }

      return next;
    });
  }, [searchResults]);

  const selectedItems = useMemo(
    () => searchResults.filter((item) => selectedUrls.has(item.url)),
    [searchResults, selectedUrls]
  );

  const allResultsSelected = useMemo(
    () => searchResults.length > 0 && searchResults.every((item) => selectedUrls.has(item.url)),
    [searchResults, selectedUrls]
  );

  const selectedCount = selectedItems.length;

  const handleFormChange = (field: keyof SearchFormState, value: string) => {
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
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

    const payload = {
      query: formState.query.trim(),
      limit: parseIntOrFallback(formState.limit, 50),
      min_duration_seconds: parseIntOrFallback(formState.minDuration, 600),
      max_duration_seconds: parseIntOrFallback(formState.maxDuration, 10800),
    };

    try {
      const data = await apiFetch<unknown>("/admin/search", { method: "POST", body: payload });
      const items = normalizeSearchResults(data);
      setSearchResults(items);
      setSelectedUrls(new Set());

      if (items.length === 0) {
        setSearchFeedback({ type: "error", message: "No results found." });
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

    setSelectedUrls(new Set(searchResults.map((item) => item.url)));
  };

  const toggleSelection = (url: string, checked: boolean) => {
    setSelectedUrls((previous) => {
      const next = new Set(previous);

      if (checked) {
        next.add(url);
      } else {
        next.delete(url);
      }

      return next;
    });
  };

  const handleAddToQueue = async () => {
    if (selectedCount === 0) {
      setQueuePlanFeedback({ type: "error", message: "Select at least one video to queue." });
      return;
    }

    setQueuePlanLoading(true);
    setQueuePlanFeedback(null);

    try {
      await apiFetch("/admin/queue/plan", {
        method: "POST",
        body: { urls: selectedItems.map((item) => item.url) },
      });

      setQueuePlanFeedback({
        type: "success",
        message: `Queued ${selectedCount} item${selectedCount === 1 ? "" : "s"}.`,
      });
      setSelectedUrls(new Set());
      await refreshQueue();
    } catch (error) {
      setQueuePlanFeedback({ type: "error", message: getErrorMessage(error) });
    } finally {
      setQueuePlanLoading(false);
    }
  };

  const runControlAction = async (
    action: "start" | "stop" | "clear" | "generate",
    request: () => Promise<void>
  ) => {
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

    void runControlAction("generate", async () => {
      await apiFetch("/admin/generate_now", { method: "POST", body: { url } });
    });
  };

  if (apiBaseUrlError) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            <h1 className="text-lg font-semibold">Configuration error</h1>
            <p className="mt-2 text-sm leading-6">{apiBaseUrlError}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!tokenChecked) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl text-sm text-slate-600">Loading…</div>
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
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
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
                    <span className="font-medium text-slate-700">Query</span>
                    <input
                      type="text"
                      value={formState.query}
                      onChange={(event) => handleFormChange("query", event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. yoga for spine"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Limit</span>
                    <input
                      type="number"
                      min={1}
                      value={formState.limit}
                      onChange={(event) => handleFormChange("limit", event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Min duration (sec)</span>
                    <input
                      type="number"
                      min={0}
                      value={formState.minDuration}
                      onChange={(event) => handleFormChange("minDuration", event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Max duration (sec)</span>
                    <input
                      type="number"
                      min={0}
                      value={formState.maxDuration}
                      onChange={(event) => handleFormChange("maxDuration", event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
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
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Results</h2>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={allResultsSelected}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  disabled={searchResults.length === 0}
                />
                Select all
              </label>
              <button
                type="button"
                onClick={handleAddToQueue}
                disabled={queuePlanLoading || searchResults.length === 0 || selectedCount === 0}
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
                    <th className="border-b border-slate-200 px-3 py-2">Transcript</th>
                    <th className="border-b border-slate-200 px-3 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                        {searchAttempted
                          ? "No results found."
                          : "Use the search above to find videos."}
                      </td>
                    </tr>
                  ) : (
                    searchResults.map((item) => {
                      const checked = selectedUrls.has(item.url);

                      return (
                        <tr key={item.url} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-3 align-top">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={checked}
                              onChange={(event) => toggleSelection(item.url, event.target.checked)}
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
                          </td>
                          <td className="px-3 py-3 align-top text-slate-700">{item.channel}</td>
                          <td className="px-3 py-3 align-top text-slate-700">{formatDuration(item.durationSeconds)}</td>
                          <td className="px-3 py-3 align-top text-slate-700">{formatDate(item.publishedAt)}</td>
                          <td className="px-3 py-3 align-top text-slate-700">
                            {item.hasTranscript == null ? "Unknown" : item.hasTranscript ? "Yes" : "No"}
                          </td>
                          <td className="px-3 py-3 align-top text-slate-600">
                            <p
                              className="whitespace-pre-wrap"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {item.descriptionSnippet || "—"}
                            </p>
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
