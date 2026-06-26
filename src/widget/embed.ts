/**
 * Script embed registration for the TCO Compare widget.
 *
 * Scans the document for `[data-tco-compare]` elements and mounts an
 * instance of the widget in each using Shadow DOM isolation.
 */

import { mountWidgets } from "./main.js";

// Auto-mount when loaded as a script embed
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mountWidgets();
    });
  } else {
    mountWidgets();
  }
}

export { createWidget, mountWidgets } from "./main.js";
