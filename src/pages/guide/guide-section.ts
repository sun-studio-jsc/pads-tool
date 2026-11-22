import { ComponentBase, customElement, html } from "fw";

interface GuideLink {
  label: string;
  url: string;
}

interface GuideEntry {
  network: string;
  /** Size limits from the reference validate page, e.g. "5MB (HTML)". */
  sizeTags: string[];
  links: GuideLink[];
}

/** Ad network reference links, taken from .plan/guide.md. */
const GUIDE_ENTRIES: GuideEntry[] = [
  {
    network: "Google Ads",
    sizeTags: ["5MB (ZIP)"],
    links: [
      { label: "Validator", url: "https://h5validator.appspot.com/adwords/asset" },
      { label: "Docs", url: "https://support.google.com/google-ads/answer/9981650?visit_id=639298957776318563-3948921259&rd=1" },
    ],
  },
  {
    network: "Unity",
    sizeTags: ["5MB (HTML)"],
    links: [
      { label: "Docs", url: "https://docs.unity.com/en-us/user-acquisition/creatives/specifications/playable#mraid-requirements" },
    ],
  },
  {
    network: "AppLovin",
    sizeTags: ["5MB (HTML)"],
    links: [
      { label: "Playable Preview", url: "https://p.applov.in/playablePreview?create=1" },
    ],
  },
  {
    network: "Mintegral",
    sizeTags: ["5MB (ZIP)"],
    links: [
      { label: "Docs", url: "https://www.playturbo.com/review/doc" },
      { label: "Review", url: "https://www.playturbo.com/review" },
    ],
  },
];

interface GeneralRequirement {
  title: string;
  body: string;
}

const GENERAL_REQUIREMENTS: GeneralRequirement[] = [
  { title: "File Size Limits", body: "Most networks enforce a maximum file size (e.g., 2MB or 5MB) for fast loading." },
  { title: "Supported Formats", body: "HTML5 is the standard, but some networks may have additional format preferences." },
  { title: "Loading Time", body: "Ads should load quickly, typically within 1–3 seconds." },
  { title: "Responsive Design", body: "Playable ads should adapt to different screen sizes and orientations." },
  { title: "API Integrations", body: "Some networks require integration with their SDKs or specific event tracking APIs." },
  { title: "Asset Optimization", body: "Use compressed images, minified scripts, and efficient code to reduce load times." },
];

const BEST_PRACTICES: string[] = [
  "Unzip downloaded archives and use the inner zip for upload.",
  "Main HTML file should be named index and placed in the root directory.",
  "Check for channel-specific restrictions (e.g., WeChat MiniGame does not support video or rigid body assets).",
  "For TikTok, ensure config.json is present and correctly formatted.",
  "Always test your playable in the official validator or preview tool before submitting.",
];

interface ReferenceLink {
  label: string;
  url: string;
}

const REFERENCES: ReferenceLink[] = [
  {
    label: "Playturbo: Playable Upload Specifications for Networks",
    url: "https://doc.playturbo.com/other-tutorials/documentation-for-project-deployment/playable-upload-specifications-for-networks",
  },
];

@customElement("guide-section")
export class GuideSection extends ComponentBase {
  render() {
    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${GUIDE_ENTRIES.map(
          (entry) => html`
            <div class="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
              <div class="flex items-center justify-between gap-3 mb-4">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">${entry.network}</h3>
                <div class="flex flex-wrap justify-end gap-2">
                  ${entry.sizeTags.map(
                    (tag) => html`<span class="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">${tag}</span>`
                  )}
                </div>
              </div>
              <ul class="space-y-2">
                ${entry.links.map(
                  (link) => html`
                    <li>
                      <a
                        href=${link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-2 text-sm text-primary hover:underline break-all"
                      >
                        <span class="material-icons-outlined" style="font-size:16px">open_in_new</span>
                        ${link.label}
                      </a>
                    </li>
                  `
                )}
              </ul>
            </div>
          `
        )}
      </div>

      <section class="mt-12">
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4">General Requirements</h2>
        <ul class="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 mb-6">
          ${GENERAL_REQUIREMENTS.map((item) => html`<li><strong>${item.title}:</strong> ${item.body}</li>`)}
        </ul>

        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">Best Practices</h2>
        <ul class="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 mb-6">
          ${BEST_PRACTICES.map((item) => html`<li>${item}</li>`)}
        </ul>

        <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4">References &amp; Further Reading</h2>
        <ul class="list-disc list-inside space-y-2">
          ${REFERENCES.map(
            (ref) => html`
              <li>
                <a href=${ref.url} target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${ref.label}</a>
              </li>
            `
          )}
        </ul>
      </section>
    `;
  }
}
