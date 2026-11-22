import { ComponentBase, customElement, html, route } from "fw";
import { BACKEND_FEATURES_ENABLED, BACKEND_ROUTES } from "../features";

/**
 * Notice shown wherever a backend-backed feature used to be.
 * Reused by `<backend-disabled-page>` and by the preview page for shared-playable links.
 */
@customElement("backend-disabled-notice")
export class BackendDisabledNotice extends ComponentBase {
  render() {
    return html`
      <div class="max-w-2xl mx-auto py-12">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center">
          <span class="material-icons-outlined text-5xl text-slate-400 dark:text-slate-600 mb-4 block">cloud_off</span>

          <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-3">This section is turned off</h1>

          <p class="text-slate-600 dark:text-slate-400 mb-3">
            Playable library, projects and the creative editor ran on a hosted backend that has been
            shut down due to lack of demand.
          </p>

          <p class="text-slate-600 dark:text-slate-400 mb-8">
            Every other tool in PlayableTools runs entirely in your browser and works as before &mdash;
            nothing is uploaded anywhere.
          </p>

          <div class="flex flex-wrap items-center justify-center gap-3">
            <a
              href="/preview"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-white font-semibold hover:bg-blue-600 transition-colors no-underline"
            >
              <span class="material-icons-outlined">visibility</span>
              Preview a playable
            </a>
            <a
              href="/"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors no-underline"
            >
              All tools
            </a>
          </div>
        </div>
      </div>
    `;
  }
}

@customElement("backend-disabled-page")
export class BackendDisabledPage extends ComponentBase {
  render() {
    return html`<backend-disabled-notice></backend-disabled-notice>`;
  }
}

// Claim the retired routes so old bookmarks and shared links get an explanation instead of a 404.
// When BACKEND_FEATURES_ENABLED flips back on, the real portfolio pages register these paths again.
if (!BACKEND_FEATURES_ENABLED) {
  for (const path of BACKEND_ROUTES) {
    route(path, {
      title: "Section unavailable | PlayableTools",
      description: "This PlayableTools section has been turned off due to lack of demand.",
      robots: "noindex,nofollow",
    })(BackendDisabledPage);
  }
}
