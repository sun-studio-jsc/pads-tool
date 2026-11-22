import { ComponentBase, customElement, html, getCurrentPath, navigate, withBase } from "fw";
import { getNavigationEventName } from "../fw/router";

interface MenuItem {
  label: string;
  icon: string;
  path: string;
}

interface MenuGroup {
  category: string;
  items: MenuItem[];
}

/**
 * Left sidebar navigation. Add new tools here.
 */
@customElement("nav-menu")
export class NavMenu extends ComponentBase {
  private menuItems: MenuGroup[] = [
    {
      category: "Main tools",
      items: [
        { label: "Preview", icon: "visibility", path: "/preview" },
        { label: "Guide", icon: "menu_book", path: "/guide" },
      ],
    },
  ];

  private get currentPath() {
    const path = getCurrentPath();
    return path === "/" ? null : path;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("popstate", this.handleNavChange);
    window.addEventListener(getNavigationEventName(), this.handleNavChange as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("popstate", this.handleNavChange);
    window.removeEventListener(getNavigationEventName(), this.handleNavChange as EventListener);
  }

  private handleNavChange = () => {
    this.requestUpdate();
  };

  render() {
    const baseClasses = "flex items-center gap-3 px-3 py-2 rounded font-medium transition-colors duration-200 no-underline";
    const activeClasses = "bg-primary text-white font-semibold";
    const inactiveClasses = "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800";

    return html`
      <nav aria-label="Main menu">
        ${this.menuItems.map(
          (group, groupIndex) => html`
            ${groupIndex > 0 ? html`<div class="my-2 border-t border-slate-200 dark:border-slate-700"></div>` : ""}
            <ul class="space-y-1">
              <li class="px-3 py-1">
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">${group.category}</p>
              </li>
              ${group.items.map((item) => {
                const isActive = this.currentPath === item.path;
                return html`
                  <li>
                    <a
                      href=${withBase(item.path)}
                      class="${baseClasses} ${isActive ? activeClasses : inactiveClasses}"
                      aria-current=${isActive ? "page" : "false"}
                      @click=${(e: MouseEvent) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        navigate(item.path);
                      }}
                    >
                      <span class="material-icons-outlined">${item.icon}</span>
                      ${item.label}
                    </a>
                  </li>
                `;
              })}
            </ul>
          `
        )}
      </nav>
    `;
  }
}
