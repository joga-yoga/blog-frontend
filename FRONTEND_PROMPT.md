## Frontend prompt for UI that matches the current backend (extended with video-based article generation)

Use this prompt verbatim in design/dev tools to keep the frontend aligned with the FastAPI backend and the new Supadata-based video flow.

---

You are designing the frontend for the **wyjazdy-blog / wiedza.joga.yoga** backend. Build a responsive, accessible UI that matches these requirements:

---

## A. Admin article generator – text & video-based flow

### 1. Article generator screen

Implement an **admin-only “Generate Article” screen** that supports:

* Text/topic-based article generation (existing behavior).
* Video-based article generation **from a single direct video URL**, tightly integrated with Supadata on the backend.

The generator form should include at least:

* `topic` – required text input for the main idea / working title.
* `rubric_code` – optional select dropdown populated from `/rubrics`.
* `keywords` – optional multi-tag input.
* `guidance` – optional long-text (textarea) for extra instructions.
* **`video_url` – new optional text input** for direct video URL.

Behavior:

* `video_url` is a **first-class field**, visible as a separate input with label like “Video URL (optional)”.
* When `video_url` is empty:

  * Use the existing **text-based** article generation path (no Supadata calls on the backend).
* When `video_url` is provided:

  * The frontend sends it in the payload as a **single string** field `video_url`.
  * Do not treat it as an array, and do not allow multiple URLs in the field UI (no multiple chips).
  * The backend will:

    * call Supadata’s universal transcript endpoint,
    * only generate the article once a transcript is available,
    * return `422` if transcript cannot be obtained or is too short.

The form submit handler should branch internally:

```ts
const isVideoBased = Boolean(payload.video_url?.trim());
```

* If `isVideoBased === true`:

  * Use video-based loading labels (e.g. “Generating from video transcript…”).
  * Assume the backend will contact Supadata and may take longer.
* If `isVideoBased === false`:

  * Preserve the current text-based UX.

All API calls should reuse the existing article create/generate endpoint used today, extended with the `video_url` field on the backend.

### 2. Direct URL input vs search flow

In addition to the direct URL field, admins may still discover videos via **search**.

Implement the following:

* **Dedicated direct URL input**

  * The `video_url` input must work even if the user never opens the search UI.
  * If the admin has a YouTube URL already, they can paste it directly and click “Generate”; the frontend should:

    * **not** call any Supadata search endpoint for this case,
    * simply send `video_url` to the backend generator endpoint.

* **Search → select → autofill**

  * Keep/implement a video search panel that allows searching via backend/Supadata (`youtube.search`).
  * From the search results table/list:

    * Each result should have a “Use this video” or similar action.
    * On click, the UI should **fill the `video_url` input** with the chosen video’s URL and focus the generator tab/form.
  * After that, generation flow should be the same as if the admin pasted the URL manually.

* **Credit efficiency**

  * The frontend must never use Supadata search solely to “validate” a URL that the admin already pasted.
  * The only path that triggers Supadata search is the explicit “search” feature, not the generator itself.

### 3. Error handling – transcript vs service

The backend will now distinguish between:

* **Transcript-level failures** (Supadata cannot fetch/generate transcript, or transcript too short).
* **Service-level failures** (Supadata/OpenAI timeouts, infrastructure issues).

Implement error handling accordingly:

1. **Validation and transcript errors (4xx, especially 422)**

   Examples:

   * “Only one video_url is supported.”
   * “Transcript unavailable or too short to generate a reliable article.”

   UI behavior:

   * Show a clear error message close to the `video_url` field and/or as a global alert.
   * Do not clear the `video_url` input.
   * Stop loading, re-enable the submit button.
   * This is a **user-fixable** error (wrong video, unsupported type, etc.).

2. **Service-level errors (5xx: 502/503)**

   Examples:

   * Supadata/LLM backend unavailable.
   * Timeouts or unexpected upstream errors.

   UI behavior:

   * Show a generic “Service temporarily unavailable. Please try again later.” message.
   * Keep form values (`topic`, `video_url`, etc.) intact.
   * Optionally surface a retry CTA/button if consistent with existing UX.
   * This is a **temporary** error, not the user’s fault.

3. **Existing validation errors**

   * Preserve the current pattern for topic/rubric/keywords validation (4xx with `detail`), and display them using the same inline error system you already use.

### 4. Loading and state management

* Disable the submit button and show a spinner or skeleton while a generation request is in flight.

* For video-based generations:

  * Use slightly more explicit messaging (e.g. “Fetching transcript and generating article…”).
  * Make it obvious that operation might take a bit longer than text-only generation.

* When the article is successfully generated:

  * Navigate to the detail/edit view of the newly created article, or show a success toast and a link, consistent with existing UX.

---

## B. Existing blog UI (keep as-is, but aligned)

In addition to the generator, the blog frontend should satisfy the existing read-only requirements.

### Core pages and routing

* **Health page**:
  Optional lightweight check that calls `GET /health/openai` and surfaces a simple status badge (green when all fields are truthy, amber otherwise).

* **Rubrics list**:
  `GET /rubrics` with optional `?all=true` toggle to show inactive rubrics.
  Show rubric `name_pl` and `code` with a filter for active/inactive.

* **Posts list**:
  `GET /posts` returns a paginated collection; support query params:

  * `search` (text search),
  * `section`,
  * `page` (1-indexed),
  * `page_size`.
    Display cards with:
  * `title`,
  * `description`,
  * `section`,
  * `categories`,
  * `tags`,
  * `updated_at`,
    and link to detail by `slug`.

* **Post detail**:
  `GET /posts/{slug}` returns a single post. Render:

  * `title`,
  * `description`,
  * `headline`,
  * `lead`,
  * `body_mdx` (render MDX/Markdown),
  * `faq` (accordion),
  * `citations` (list with source url + title if present),
  * optional SEO fields `canonical`, `robots`.
    Respect `locale` for language-specific labels.

* **Articles list**:
  `GET /articles` returns `{ meta, items }`; `meta` includes pagination info.
  Each item mirrors the post shape under top-level keys and must surface:

  * `slug`,
  * `title`,
  * `description`,
  * `section`,
  * `categories`,
  * `tags`,
  * `updated_at`.

* **Article detail**:
  `GET /articles/{slug}` returns `{ post: { ... } }`.
  Render the `post` payload the same way as Post detail.

### Data envelopes and pagination

* Expect list endpoints to include pagination metadata (`page`, `page_size`, `pages`, `total`) either under:

  * `meta` (`/articles`), or
  * alongside the list (`/posts`).

* Provide pagination controls (next/prev, specific pages) and empty-state messaging.

* Handle HTTP errors gracefully:

  * Retry CTA for 5xx,
  * Validation error text from the `detail` field for 4xx.

### Content rendering

* Render `body_mdx` as Markdown/MDX with support for:

  * headings,
  * ordered/unordered lists,
  * blockquotes,
  * inline code.

* FAQ items (`question`, `answer`) appear as collapsible panels.

* Citations render as a numbered list with a link when a URL is present.

* If `lead` is missing, fall back to the first paragraph of `body_mdx` preview (first 200 chars).

### Filters and search

* Posts page:

  * filter by `section` (dropdown from distinct values returned in list),
  * search by free text (`search` param),
  * allow multi-select chips for `tags`/`categories` based on data present in the current page.

* Rubrics page:

  * toggle to include inactive items via `?all=true`.

### Accessibility & UX

* WCAG AA contrast, focus-visible outlines, and keyboard navigation for all interactive controls.
* Loading skeletons/spinners for list and detail views while awaiting API responses.
* Internationalization-ready labels; default to Polish copy where relevant (`name_pl` hints the primary language).

### Environment & configuration

* The backend expects `APP_ENV=prod` to lock CORS to trusted origins; design should allow configuring API base URL at runtime (env/config file) without rebuilds.
* Surface OpenAI/Deep Search dependency status via the `/health/openai` widget to aid debugging.

### API assumptions (do not change)

* All list/detail endpoints are `GET` and return JSON; no mutations are exposed in this read-only scope.
* `slug` is the stable identifier for linking detail pages.
* Date fields are ISO timestamps; format them client-side to a human-readable date.

---

Deliver a clean, content-first layout that:

* Highlights travel/wellness storytelling for readers.
* Provides an ergonomic admin article generator where:

  * video-based generation always starts from a real transcript,
  * direct video URLs are first-class,
  * no article is ever generated solely from a title or metadata when a transcript is unavailable.
