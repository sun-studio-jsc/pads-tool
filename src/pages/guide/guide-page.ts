import { ComponentBase, customElement, html, route } from "fw";
import "./guide-section";

@customElement("guide-page")
@route("/guide", {
  title: "Technical Requirements of Ad Networks | PlayableTools",
  description: "Technical requirements, file size limits and validator links for major ad networks.",
})
export class GuidePage extends ComponentBase {
  render() {
    return html`
      <div class="max-w-7xl mx-auto">
        <header class="pb-6 border-b border-slate-200 dark:border-slate-800 mb-6">
          <h1 class="text-3xl font-bold text-slate-900 dark:text-white">Technical Requirements of Ad Networks</h1>
          <p class="mt-2 text-slate-600 dark:text-slate-400">Validators, documentation and file size limits for each ad network.</p>
        </header>

        <guide-section></guide-section>
      </div>
    `;
  }
}
