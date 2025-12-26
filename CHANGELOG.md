# Changelog

## Unreleased

- Homepage article cards now include the short lead text from the list API response.
- Refactored canonical URL handling to always compute self-referential HTTPS URLs and ignore API-provided canonicals.
- Added canonical guard utilities with unit tests to prevent regressions and ensure sanitized pagination handling.
- Temporarily disabled ISR for article detail pages to flush cached canonicals during rollout.

