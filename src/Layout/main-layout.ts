import type { TemplateResult } from "lit";
import { customElement, html, LayoutComponentBase, property } from "fw";
import "./site-logo";
import "./nav-menu";

/**
 * Page layout with a fixed left sidebar on desktop and a slide-in drawer on mobile.
 * Wired in as the router's defaultLayout in app-root.ts; the routed page renders into `body`.
 */
@customElement("main-layout")
export class MainLayout extends LayoutComponentBase {
  @property({ attribute: false, type: Object })
  body?: TemplateResult;

  @property({ type: Boolean })
  sidebarOpen = false;

  private toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  private closeSidebar() {
    this.sidebarOpen = false;
  }

  render() {
    return html`
      <div class="flex flex-col md:flex-row h-screen font-display bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-200 antialiased">
        <!-- Mobile header -->
        <header class="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <site-logo></site-logo>
          <button @click=${this.toggleSidebar} aria-label="Open menu" class="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <span class="material-icons-outlined">menu</span>
          </button>
        </header>

        <!-- Sidebar -->
        <aside class="${this.sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:static z-20 w-64 h-full flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col p-4 transition-transform duration-300 ease-in-out">
          <div class="flex items-center gap-4 mb-8">
            <site-logo></site-logo>
            <button @click=${this.closeSidebar} aria-label="Close menu" class="md:hidden ml-auto text-slate-500">
              <span class="material-icons-outlined">close</span>
            </button>
          </div>

          <div class="flex-grow overflow-y-auto">
            <nav-menu></nav-menu>
          </div>
        </aside>

        <!-- Overlay for mobile sidebar -->
        ${this.sidebarOpen ? html`<div class="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden" @click=${this.closeSidebar}></div>` : ""}

        <main class="flex-1 p-4 md:p-8 overflow-y-auto">
          ${this.body}
        </main>
      </div>
    `;
  }
}
