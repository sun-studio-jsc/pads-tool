# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: Vite dev server on http://localhost:5173 (`strictPort`, so it fails if the port is taken; check for a leftover dev server first).
- `npm run build`: `tsc && vite build`. Output goes to `dist/`.
- `npm run preview`: serves `dist/` on port 5173.
- Type check only: `npx tsc -p tsconfig.json` (`noEmit`; strict, with `noUnusedLocals` and `noUnusedParameters`).
- There is no lint script and no test runner or test files. Nothing runs a single test.

## Reference project

`references/` holds read-only reference material. Today it contains `references/PlayableTools-main/`, a copy of the upstream app.

- Do not create, edit, rename, or delete anything inside `references/`, including its subfolders. Read it to compare behavior or find code to copy, and copy code out of it into the project.
- New work goes in `src/`, `public/`, and the root config files.

## Architecture

This repo is a clone of the preview tool from PlayableTools. It keeps the upstream conventions, so the upstream `AGENTS.md` and `docs/` are the best background reading.

**Boot sequence.** `index.html` loads `src/app-root.ts`. That file imports `reflect-metadata` first, which the DI decorators need. It then imports `theme.css` and eagerly loads every `src/pages/**/*.ts` file with `import.meta.glob`. Each `@route(...)` decorator registers its page in `routeRegistry` (`src/fw/router.ts`). The app renders a single `<router-outlet>`, which picks the page by matching `window.location.pathname` against the registered routes. A request for `/` is redirected to `/preview`.

**Framework (`src/fw/`).** This is a small custom layer on Lit 3, and every import comes from the `fw` alias (aliased in `vite.config.ts` and `tsconfig.json`):
- `ComponentBase` and `LayoutComponentBase` are Lit components that render into light DOM, not shadow DOM.
- `di.ts` is a DI container. Services are `@injectable(ServiceLifetime.*)` and default to singletons. Components get them with `@inject(ServiceClass)`.
- `navigate()` changes the URL and dispatches a navigation event. `router-outlet` listens for that event and re-renders. `from-query.ts` binds query parameters to properties.

**Preview tool.** `src/pages/preview/preview-page.ts` is the orchestrator. It delegates to these parts:
- `playable-previewer.ts` shows the playable in an iframe with device and orientation presets.
- `PreviewService` (`src/services/PreviewService.ts`) holds the state. It tracks the uploaded content, the preset and language selection, and the script injection done by `processContentWithPreset`. It loads playables from a file, a ZIP, or a remote URL.
- ZIP playables are extracted with JSZip. Their assets are stored in Cache storage under a session ID, and `public/zip-preview-sw.js` serves them at `<base>zip-preview/<sessionId>/<path>`. `getBasePath()` builds those URLs.
- Recording: `recorder-popup.ts` runs in its own window, captures the tab with `getDisplayMedia`, and records with `MediaRecorder`. `preview-video-modal.ts` trims the result through `PreviewService.trimRecordedVideo`. That method uses mediabunny (WebCodecs) first and falls back to FFmpeg.wasm, which is loaded from `node_modules`.
- `VideoStorageService` keeps saved recordings in IndexedDB through `idb-keyval`.
- Presets are defined in `src/assets/preview-presets.json`.

**Backend-dependent code is dormant.** `src/features.ts` sets `BACKEND_FEATURES_ENABLED = false`. `PortfolioService`, `ApiClient`, and `AuthenticationService` exist but are unused. `backend-disabled-page.ts` claims the old backend routes so they don't show a 404. Enable the backend only by following the steps written in `features.ts`.

**Publishing.** `PlayablePublishService` and `ImbaPackerService` are browser adapters over `@gritsenko/cta-core`, which is the same packing engine that the reference project's CLI and MCP use.

**Not in this clone.** The reference's layout (`src/Layout/`), home page, portfolio pages, SEO prerendering (`seo/` exists, but nothing builds from it), version checking, and PWA setup are all absent. `public/files/` (APK and ZIP downloads) was also left out.

## Gotchas

- `vite.config.ts` is an ES module (`"type": "module"`), so use `import.meta.url`. `__dirname` is undefined.
- Keep styles out of inline `<style>` blocks in `index.html`. An inline style broke `vite build` with an html-proxy error. Put styles in `src/theme.css`.
- `index.html` must not contain a `<base href>`. It would break relative URLs on nested routes such as `/preview/...`.
- `npm install` prints a warning that `esbuild` has an unapproved postinstall script. Run `npm install-scripts approve esbuild` if esbuild fails.
- `dist/`, `node_modules/`, and `*.log` are gitignored.
