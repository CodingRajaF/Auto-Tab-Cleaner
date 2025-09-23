# AGENTS.md
## Character
日本語でカジュアルな口調で会話してください。

## Overview
Auto-Tab-Cleaner is a Chrome extension that trims inactive tabs while letting users control what stays open. This file helps human and AI contributors pick the right responsibilities and follow project norms.

## Project Snapshot
- Core logic lives in `src/background.js` (idle tracking, cleanup scheduler) and `src/options.js` (persisted settings via `chrome.storage`).
- User-facing pieces are `src/popup.html`/`src/popup.js` for at-a-glance control and `src/options.html` for detailed configuration.
- Styling relies on plain CSS embedded in the HTML files; there is no build step or bundler.
- Documentation lives under `docs/`; coding conventions are in `src/CODEING_GUIDLINE_EN.md` and `src/CODING_GUIDELINE_JA.md`.

## Agent Roles

### Maintainer-Agent
- Owns architecture decisions, idle-tab policy, and cross-file consistency.
- Keeps `manifest.json` permissions minimal and version accurate.
- Syncs roadmap items from `README.md` with the implementation status.

### Automation-Agent
- Evolves tab cleanup heuristics in `background.js` (scheduling, whitelists, limits).
- Writes focused unit-style helpers and keeps side effects behind wrapper functions.
- Adds telemetry hooks or logging only when they support user-visible recovery.

### UX-Agent
- Iterates on popup and options UI for clarity and accessibility.
- Maintains component structure in `popup.js`/`options.js` and ensures text gets localized-ready wrappers when possible.
- Validates flows manually: load unpacked extension -> change settings -> observe tab cleanup behaviour.

### Documentation-Agent
- Curates user and developer docs in `docs/` plus top-level `README.md`.
- Cross-links new features with issue templates inside `.github/ISSUE_TEMPLATE`.
- Keeps changelog sections ready for release packaging (even while `docs/CHANGELOG.md` is "coming soon").

## Shared Practices
- Follow the naming and commenting standards in `src/CODEING_GUIDLINE_EN.md`.
- Prefer small, pure functions; centralize Chrome API calls so they are easy to stub in tests.
- When changing cleanup logic, document edge cases (pinned tabs, incognito, discarded tabs) inside inline comments.
- Run a smoke test after every change: reload extension in Chrome, toggle settings, open idle tabs, confirm expected closures.

## Open Questions for Future Agents
- Define automated tests or linting once the project adopts a build tool.
- Decide on localization strategy before translating UI strings.
- Establish telemetry policy for logging closed tabs without exposing sensitive history.
