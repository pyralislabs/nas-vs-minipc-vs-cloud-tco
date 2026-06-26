import type { ComparisonResult, SensitivityResult } from "../core/types.js";
import { formatMoney } from "../format/money.js";

/**
 * Format a comparison result as human-readable text.
 */
export function formatComparisonResult(
  result: ComparisonResult,
  locale: string,
  showLinks = false,
): string {
  const lines: string[] = [];
  lines.push(`Comparison: ${result.input.label}`);
  lines.push(`ID: ${result.input.id}`);
  lines.push(`Horizon: ${result.input.horizonMonths} months`);
  lines.push(`Currency: ${result.input.currency}`);
  lines.push(`Price basis: ${result.input.priceBasis}`);
  lines.push("");

  for (const scenario of result.scenarios) {
    lines.push(`--- ${scenario.label} (${scenario.kind}) ---`);
    lines.push(`  Gross TCO: ${formatMoney(scenario.grossCashTco, result.input.currency, locale)}`);
    lines.push(`  Net TCO: ${formatMoney(scenario.netCashTco, result.input.currency, locale)}`);

    if (scenario.kind === "owned") {
      lines.push(`  Salvage: ${formatMoney(scenario.salvageValue, result.input.currency, locale)}`);
      if (scenario.depreciation) {
        lines.push("  Depreciation (non-cash reporting):");
        lines.push(
          `    Monthly: ${formatMoney(scenario.depreciation.monthlyDepreciation, result.input.currency, locale)}`,
        );
        lines.push(
          `    Accumulated: ${formatMoney(scenario.depreciation.accumulatedDepreciation, result.input.currency, locale)}`,
        );
        lines.push(
          `    End book value: ${formatMoney(scenario.depreciation.endBookValue, result.input.currency, locale)}`,
        );
      }
    }
    lines.push("");
  }

  lines.push("--- Break-Even Analysis ---");
  for (const be of result.pairBreakEvens) {
    lines.push(`  ${be.ownedScenarioId} vs ${be.cloudScenarioId}:`);
    if (be.durableBreakEvenMonth !== null) {
      lines.push(`    Durable break-even: month ${be.durableBreakEvenMonth}`);
    } else {
      lines.push("    No durable break-even in horizon");
    }
    if (be.crossoverMonths.length > 0) {
      lines.push(`    Crossover months: ${be.crossoverMonths.join(", ")}`);
    }
  }
  lines.push("");

  lines.push("--- Recommendation ---");
  lines.push(`  ${result.recommendation.explanation}`);
  lines.push(`  ${result.recommendation.disclaimer}`);
  lines.push("");

  if (showLinks) {
    lines.push("--- Contextual Links ---");
    lines.push("  https://minipclab.com/ — Mini PC and homelab buying guides");
    lines.push("  https://localairigs.com/ — Local AI hardware and cloud comparisons");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format human-readable output for sensitivity results.
 */
export function formatSensitivityResult(
  result: SensitivityResult,
  locale: string,
  showLinks = false,
): string {
  const lines: string[] = [];
  lines.push("=== Base Comparison ===");
  lines.push("");
  lines.push(formatComparisonResult(result.base, locale, false));

  lines.push("=== Sensitivity Cases ===");
  for (const c of result.cases) {
    if ("error" in c) {
      lines.push(`  ${c.label} (${c.id}): ERROR - ${c.error.message}`);
    } else {
      lines.push(`  ${c.label} (${c.id}):`);
      lines.push(`    ${c.result.recommendation.explanation}`);
      lines.push("");
    }
  }

  lines.push("--- Overall Recommendation ---");
  lines.push(`  ${result.recommendation.explanation}`);
  lines.push(`  ${result.recommendation.disclaimer}`);

  if (showLinks) {
    lines.push("");
    lines.push("--- Contextual Links ---");
    lines.push("  https://minipclab.com/ — Mini PC and homelab buying guides");
    lines.push("  https://localairigs.com/ — Local AI hardware and cloud comparisons");
  }

  return lines.join("\n");
}
