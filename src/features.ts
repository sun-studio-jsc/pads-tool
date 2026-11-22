/**
 * Feature flags for functionality that depends on the PlayableTools backend
 * (https://api.gritsenko.biz — ASP.NET Core + LiteDB, see the PlayableTools.Backend repo).
 *
 * The backend-backed sections (portfolio / projects / creative editor, "Save to Library",
 * portfolio sharing and project-driven publish URLs) are switched off: the hosted backend
 * was retired due to lack of demand.
 *
 * To bring them back:
 *   1. set BACKEND_FEATURES_ENABLED to true;
 *   2. restore the portfolio pages in the route glob inside `src/app-root.ts`
 *      (drop the "!./pages/portfolio/**" exclusion);
 *   3. point VITE_API_BASE_URL at a running backend instance.
 */
export const BACKEND_FEATURES_ENABLED: boolean = false;

/**
 * Routes that belonged to the backend-backed sections. While the backend is off they are
 * served by `<backend-disabled-page>` instead of 404, so old links explain themselves.
 */
export const BACKEND_ROUTES = [
  "/portfolio",
  "/projects",
  "/projects/new",
  "/projects/:id/edit",
  "/editor/:creativeId?/:variationId?",
] as const;

/**
 * Validator panel on the preview page (the "Validation Results" card with the
 * validator/preset dropdown, language switcher and check list).
 *
 * Hidden for this version. To show it again, set this to true.
 */
export const VALIDATOR_ENABLED: boolean = false;

/**
 * SDK Event Log panel under the preview (captures CTA SDK / Yandex Games SDK events).
 *
 * Hidden for this version. To show it again, set this to true.
 */
export const SDK_EVENT_LOG_ENABLED: boolean = false;
