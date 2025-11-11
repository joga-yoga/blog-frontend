# LLM Text Generation Toolkit

This directory contains the tooling used to generate markdown "twins" for published articles.

## Usage

Run the generator in the project root:

```bash
npm run llmtext:generate
```

Optionally pass a path to a payload file or directory:

```bash
npm run llmtext:generate -- data/payloads/sample-yoga-breathing.json
npm run llmtext:generate -- data/payloads
```

The command reads payloads, validates them against the article schema, and writes deterministic markdown files under `public/llmtext/blog/`.

## Safeguards

- The generator never mutates source data and writes output atomically.
- Files are rewritten only when the generated content changes.
- Failures on individual payloads do not prevent other articles from being processed.

## Known Limitations

- Batch mode currently relies on local fixtures located in `data/payloads/`.
- FAQ and citation sections are omitted when data is not available.
- No remote fetching of articles is implemented yet.

## TODO

- Integrate remote, read-only article retrieval for batch runs.
- Wire the generator into CI (e.g., GitHub Actions).
- Inject `<link rel="alternate" type="text/markdown">` into the article template once the backend provides the slug in rendering context.
