import "reflect-metadata";

import { ComponentBase, customElement, html, navigate } from "./fw";
import "./fw/update-notification";

import "./theme.css";
import { MainLayout } from "./Layout/main-layout";

// Eagerly import all page modules so their @route decorators register.
import.meta.glob("./pages/**/*.ts", { eager: true });

@customElement("app-root")
export class AppRoot extends ComponentBase {
  connectedCallback() {
    super.connectedCallback();
    // This clone only ships the preview tool, so the root path goes straight to it.
    if (window.location.pathname === "/") {
      navigate("/preview", { replace: true });
    }
  }

  render() {
    return html`<router-outlet .defaultLayout=${MainLayout}></router-outlet>`;
  }
}
