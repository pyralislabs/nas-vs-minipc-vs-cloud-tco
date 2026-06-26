import { SUPPORTED_LOCALES } from "../schema/locales.js";
import { WIDGET_IMPORT_MAX_BYTES } from "../schema/limits.js";
import { calculateComparison } from "../core/calculate.js";
import { formatMoney } from "../format/money.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - precompiled validator has no TS declarations
import validate from "../schema/validator.precompiled.mjs";

const DEFAULT_LOCALE = "en-US";

export interface WidgetOptions {
  locale?: string;
  theme?: "light" | "dark" | undefined;
}

interface GuidedFormData {
  ownedLabel: string;
  ownedCapex: string;
  ownedEnergy: string;
  ownedRate: string;
  ownedMaint: string;
  cloudLabel: string;
  cloudCompute: string;
  cloudStorage: string;
  cloudEgressGb: string;
  cloudEgressRate: string;
  horizon: string;
}

function buildGuidedInput(data: GuidedFormData): unknown {
  return {
    schemaVersion: 1,
    id: "widget-guided",
    label: "Widget Quick Compare",
    baseDate: new Date().toISOString().slice(0, 10),
    currency: "USD",
    priceBasis: "constant",
    horizonMonths: parseInt(data.horizon, 10) || 36,
    materialityThresholdPercent: "10",
    scenarios: [
      {
        id: "owned",
        label: data.ownedLabel || "Owned Hardware",
        kind: "owned",
        assetType: "other-owned",
        initialCapex: [{ id: "capex", label: "Initial Capex", amount: data.ownedCapex || "0" }],
        annualEnergyKwh: data.ownedEnergy || "0",
        electricityRatePerKwh: data.ownedRate || "0.14",
        electricityEscalationRate: "0",
        annualMaintenance: data.ownedMaint || "0",
        maintenanceEscalationRate: "0",
      },
      {
        id: "cloud",
        label: data.cloudLabel || "Cloud Service",
        kind: "cloud",
        monthlyRecurring: [
          {
            id: "compute",
            label: "Compute",
            monthlyAmount: data.cloudCompute || "0",
            annualEscalationRate: "0",
          },
          {
            id: "storage",
            label: "Storage",
            monthlyAmount: data.cloudStorage || "0",
            annualEscalationRate: "0",
          },
        ],
        monthlyEgressGb: data.cloudEgressGb || "0",
        egressRatePerGb: data.cloudEgressRate || "0.09",
        egressEscalationRate: "0",
      },
    ],
  };
}

function tryValidate(
  input: unknown,
): Array<{ code: string; path: string; message: string }> | null {
  if (!validate(input)) {
    return [{ code: "validation:failed", path: "/", message: "Input failed schema validation" }];
  }
  return null;
}

function dispatchError(host: HTMLElement, code: string, message: string): void {
  host.dispatchEvent(
    new CustomEvent("tco-compare:error", { detail: { code, message }, bubbles: true }),
  );
}

function renderResults(
  host: HTMLElement,
  resultsEl: HTMLElement,
  input: unknown,
  locale: string,
): void {
  try {
    const result = calculateComparison(input as Parameters<typeof calculateComparison>[0]);

    const lines: string[] = [];
    lines.push(`Comparison: ${result.input.label}`);
    lines.push(`Horizon: ${result.input.horizonMonths} months`);

    for (const scenario of result.scenarios) {
      const gross = formatMoney(scenario.grossCashTco, result.input.currency, locale);
      const net = formatMoney(scenario.netCashTco, result.input.currency, locale);
      lines.push("");
      lines.push(`${scenario.label} (${scenario.kind}):`);
      lines.push(`  Gross TCO: ${gross}`);
      lines.push(`  Net TCO: ${net}`);
    }

    for (const be of result.pairBreakEvens) {
      if (be.durableBreakEvenMonth !== null) {
        lines.push(`  Durable break-even: month ${be.durableBreakEvenMonth}`);
      } else {
        lines.push("  No durable break-even in horizon");
      }
    }

    lines.push("");
    lines.push(result.recommendation.explanation);
    lines.push(result.recommendation.disclaimer);

    resultsEl.textContent = lines.join("\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    resultsEl.textContent = `Calculation error: ${msg}`;
    dispatchError(host, "calculation:failed", msg);
  }
}

export function createWidget(host: HTMLElement, options: WidgetOptions = {}): void {
  const shadow = host.attachShadow({ mode: "open" });

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styles);
  shadow.adoptedStyleSheets = [sheet];

  let locale = options.locale ?? DEFAULT_LOCALE;
  if (locale && !SUPPORTED_LOCALES.includes(locale)) {
    console.warn(`Unsupported locale "${locale}", falling back to "${DEFAULT_LOCALE}"`);
    locale = DEFAULT_LOCALE;
  }

  const container = document.createElement("div");
  container.className = "tco-widget";

  const title = document.createElement("h2");
  title.textContent = "TCO Comparison Calculator";
  container.appendChild(title);

  const resultsSection = document.createElement("div");
  resultsSection.className = "tco-results";
  resultsSection.setAttribute("role", "region");
  resultsSection.setAttribute("aria-live", "polite");
  resultsSection.setAttribute("aria-label", "Calculation results");
  container.appendChild(resultsSection);

  const tabs = document.createElement("div");
  tabs.className = "tco-tabs";
  tabs.setAttribute("role", "tablist");

  const quickTab = document.createElement("button");
  quickTab.type = "button";
  quickTab.textContent = "Quick Compare";
  quickTab.setAttribute("role", "tab");
  quickTab.setAttribute("aria-selected", "true");
  quickTab.className = "tco-tab tco-tab-active";

  const advancedTab = document.createElement("button");
  advancedTab.type = "button";
  advancedTab.textContent = "Advanced JSON Import";
  advancedTab.setAttribute("role", "tab");
  advancedTab.setAttribute("aria-selected", "false");
  advancedTab.className = "tco-tab";

  tabs.appendChild(quickTab);
  tabs.appendChild(advancedTab);
  container.appendChild(tabs);

  const guidedSection = createGuidedForm(locale, host, resultsSection);
  guidedSection.id = "tco-guided-panel";
  guidedSection.setAttribute("role", "tabpanel");
  container.appendChild(guidedSection);

  const advancedSection = createAdvancedImport(locale, host, resultsSection);
  advancedSection.id = "tco-advanced-panel";
  advancedSection.setAttribute("role", "tabpanel");
  advancedSection.style.display = "none";
  container.appendChild(advancedSection);

  quickTab.addEventListener("click", () => {
    quickTab.setAttribute("aria-selected", "true");
    quickTab.className = "tco-tab tco-tab-active";
    advancedTab.setAttribute("aria-selected", "false");
    advancedTab.className = "tco-tab";
    guidedSection.style.display = "";
    advancedSection.style.display = "none";
  });

  advancedTab.addEventListener("click", () => {
    advancedTab.setAttribute("aria-selected", "true");
    advancedTab.className = "tco-tab tco-tab-active";
    quickTab.setAttribute("aria-selected", "false");
    quickTab.className = "tco-tab";
    guidedSection.style.display = "none";
    advancedSection.style.display = "";
  });

  const footer = document.createElement("div");
  footer.className = "tco-footer";
  const linkData = [
    { href: "https://minipclab.com/", label: "MiniPCLab" },
    { href: "https://localairigs.com/", label: "Local AI Rigs" },
  ];
  for (const link of linkData) {
    const a = document.createElement("a");
    a.href = link.href;
    a.textContent = link.label;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    footer.appendChild(a);
    footer.appendChild(document.createTextNode(" "));
  }
  container.appendChild(footer);

  shadow.appendChild(container);
}

function createGuidedForm(locale: string, host: HTMLElement, resultsEl: HTMLElement): HTMLElement {
  const section = document.createElement("section");
  section.className = "tco-guided";

  const heading = document.createElement("h3");
  heading.textContent = "Quick Compare";
  section.appendChild(heading);

  const p = document.createElement("p");
  p.textContent = "Enter your assumptions below for a one-owned vs one-cloud comparison.";
  section.appendChild(p);

  const fields: Array<{ id: string; label: string; defaultValue: string; type: string }> = [
    { id: "owned-label", label: "Owned Scenario Label", defaultValue: "My NAS", type: "text" },
    { id: "owned-capex", label: "Initial Capex ($)", defaultValue: "830", type: "number" },
    { id: "owned-energy", label: "Annual Energy (kWh)", defaultValue: "240", type: "number" },
    { id: "owned-rate", label: "Electricity Rate ($/kWh)", defaultValue: "0.14", type: "number" },
    { id: "owned-maint", label: "Annual Maintenance ($)", defaultValue: "50", type: "number" },
    {
      id: "cloud-label",
      label: "Cloud Scenario Label",
      defaultValue: "Cloud Service",
      type: "text",
    },
    { id: "cloud-compute", label: "Cloud Compute ($/month)", defaultValue: "25", type: "number" },
    { id: "cloud-storage", label: "Cloud Storage ($/month)", defaultValue: "10", type: "number" },
    { id: "cloud-egress-gb", label: "Monthly Egress (GB)", defaultValue: "50", type: "number" },
    { id: "cloud-egress-rate", label: "Egress Rate ($/GB)", defaultValue: "0.09", type: "number" },
    { id: "horizon", label: "Horizon (months)", defaultValue: "60", type: "number" },
  ];

  const form = document.createElement("div");
  form.className = "tco-form";

  for (const field of fields) {
    const labelEl = document.createElement("label");
    labelEl.textContent = field.label;
    const input = document.createElement("input");
    input.type = field.type;
    input.value = field.defaultValue;
    input.id = `guided-${field.id}`;
    input.setAttribute("aria-label", field.label);
    input.className = "tco-input";
    labelEl.appendChild(input);
    form.appendChild(labelEl);
  }

  const calcButton = document.createElement("button");
  calcButton.type = "button";
  calcButton.textContent = "Calculate";
  calcButton.className = "tco-button";
  calcButton.addEventListener("click", () => {
    const inputs = Array.from(form.querySelectorAll("input"));
    const values: Record<string, string> = {};
    for (const inp of inputs) {
      const key = inp.id.replace("guided-", "");
      values[key] = inp.value;
    }

    const data: GuidedFormData = {
      ownedLabel: values["owned-label"] || "",
      ownedCapex: values["owned-capex"] || "0",
      ownedEnergy: values["owned-energy"] || "0",
      ownedRate: values["owned-rate"] || "0.14",
      ownedMaint: values["owned-maint"] || "0",
      cloudLabel: values["cloud-label"] || "",
      cloudCompute: values["cloud-compute"] || "0",
      cloudStorage: values["cloud-storage"] || "0",
      cloudEgressGb: values["cloud-egress-gb"] || "0",
      cloudEgressRate: values["cloud-egress-rate"] || "0.09",
      horizon: values["horizon"] || "36",
    };

    const input = buildGuidedInput(data);
    const schemaIssues = tryValidate(input);
    if (schemaIssues) {
      dispatchError(host, "validation:failed", schemaIssues[0]!.message);
      resultsEl.textContent = "Validation error: check your inputs.";
      return;
    }

    renderResults(host, resultsEl, input, locale);
  });
  form.appendChild(calcButton);

  section.appendChild(form);
  return section;
}

function createAdvancedImport(
  locale: string,
  host: HTMLElement,
  resultsEl: HTMLElement,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "tco-advanced";

  const heading = document.createElement("h3");
  heading.textContent = "Advanced JSON Import";
  section.appendChild(heading);

  const textarea = document.createElement("textarea");
  textarea.rows = 8;
  textarea.cols = 60;
  textarea.placeholder = "Paste comparison JSON here...";
  textarea.setAttribute("aria-label", "Comparison JSON input");
  textarea.className = "tco-textarea";
  section.appendChild(textarea);

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.textContent = "Import JSON";
  importButton.className = "tco-button";
  importButton.addEventListener("click", () => {
    const raw = textarea.value;
    if (raw.length > WIDGET_IMPORT_MAX_BYTES) {
      dispatchError(host, "limits:input-size", `Input exceeds 256 KiB limit (${raw.length} bytes)`);
      resultsEl.textContent = "Input too large (max 256 KiB).";
      return;
    }

    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      dispatchError(host, "cli:parse", "Invalid JSON input");
      resultsEl.textContent = "Invalid JSON. Please check your input.";
      return;
    }

    const schemaIssues = tryValidate(input);
    if (schemaIssues) {
      dispatchError(host, "validation:failed", schemaIssues[0]!.message);
      resultsEl.textContent = "Validation error: check your JSON input.";
      return;
    }

    renderResults(host, resultsEl, input, locale);
  });
  section.appendChild(importButton);

  return section;
}

export function mountWidgets(): void {
  const elements = document.querySelectorAll("[data-tco-compare]");
  for (const el of Array.from(elements)) {
    if (el instanceof HTMLElement && !el.shadowRoot) {
      const locale = el.getAttribute("data-locale") ?? DEFAULT_LOCALE;
      const theme = el.getAttribute("data-theme") as "light" | "dark" | null;
      createWidget(el, { locale, theme: theme ?? undefined });
    }
  }
}

const styles = `
:host {
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a2e;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  max-width: 720px;
}
.tco-widget { display: flex; flex-direction: column; gap: 12px; }
.tco-widget h2 { margin: 0; font-size: 18px; font-weight: 600; }
.tco-widget h3 { margin: 0 0 8px; font-size: 15px; font-weight: 600; }
.tco-tabs { display: flex; gap: 4px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
.tco-tab { padding: 6px 14px; border: 1px solid transparent; border-radius: 4px 4px 0 0; background: transparent; cursor: pointer; font-size: 13px; font-weight: 500; color: #666; }
.tco-tab-active { background: #f0f7ff; border-color: #e0e0e0 #e0e0e0 #f0f7ff; color: #1a1a2e; }
.tco-guided, .tco-advanced { padding: 12px 0; }
.tco-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
.tco-form label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; font-weight: 500; color: #555; }
.tco-input, .tco-textarea { padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; font-family: inherit; }
.tco-textarea { width: 100%; box-sizing: border-box; resize: vertical; }
.tco-button { padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer; justify-self: start; }
.tco-button:hover { background: #1d4ed8; }
.tco-button:focus-visible, .tco-input:focus-visible, .tco-textarea:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.tco-results { border: 1px solid #e8e8e8; border-radius: 6px; padding: 12px; min-height: 48px; white-space: pre-wrap; font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace; font-size: 12px; line-height: 1.6; }
.tco-footer { display: flex; gap: 12px; justify-content: center; font-size: 12px; border-top: 1px solid #e8e8e8; padding-top: 12px; }
.tco-footer a { color: #2563eb; text-decoration: none; }
.tco-footer a:hover { text-decoration: underline; }
:host([data-theme="dark"]) { color: #e0e0e0; background: #1a1a2e; border-color: #333; }
:host([data-theme="dark"]) .tco-tab-active { background: #2a2a3e; border-color: #333 #333 #2a2a3e; color: #e0e0e0; }
:host([data-theme="dark"]) .tco-tab { color: #999; }
:host([data-theme="dark"]) .tco-guided, :host([data-theme="dark"]) .tco-advanced, :host([data-theme="dark"]) .tco-results { border-color: #333; }
:host([data-theme="dark"]) .tco-footer { border-color: #333; }
:host([data-theme="dark"]) .tco-input, :host([data-theme="dark"]) .tco-textarea { background: #2a2a3e; color: #e0e0e0; border-color: #444; }
:host([data-theme="dark"]) .tco-button { background: #3b82f6; }
:host([data-theme="dark"]) .tco-button:hover { background: #2563eb; }
@media (max-width: 480px) { :host { padding: 12px; border-radius: 0; border-left: none; border-right: none; } .tco-form { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .tco-button { transition: none; } }
@media (prefers-contrast: more) { .tco-input, .tco-textarea { border-color: #000; } }
`;
