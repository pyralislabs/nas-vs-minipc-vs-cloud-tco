import { describe, it, expect, beforeEach } from "vitest";
import { analyzeSensitivity } from "../../src/core/sensitivity.js";
import { D } from "../../src/core/money.js";
import type {
  ComparisonInput,
  SensitivityCase,
  OwnedScenarioInput,
  CloudScenarioInput,
} from "../../src/core/types.js";

beforeEach(() => {
  D.set({ precision: 28, rounding: D.ROUND_HALF_EVEN });
});

function makeComparison(overrides?: Partial<ComparisonInput>): ComparisonInput {
  return {
    schemaVersion: 1,
    id: "test-comp",
    label: "Test Comparison",
    baseDate: "2026-01-01",
    currency: "USD",
    priceBasis: "constant",
    horizonMonths: 36,
    materialityThresholdPercent: "10",
    scenarios: [
      {
        id: "test-nas",
        label: "Test NAS",
        kind: "owned",
        assetType: "nas",
        initialCapex: [{ id: "unit", label: "Unit", amount: "800.00" }],
        annualEnergyKwh: "240",
        electricityRatePerKwh: "0.14",
        electricityEscalationRate: "0",
        annualMaintenance: "50.00",
        maintenanceEscalationRate: "0",
      } satisfies OwnedScenarioInput,
      {
        id: "test-cloud",
        label: "Test Cloud",
        kind: "cloud",
        monthlyRecurring: [
          { id: "compute", label: "Compute", monthlyAmount: "50.00", annualEscalationRate: "0" },
        ],
        monthlyEgressGb: "50",
        egressRatePerGb: "0.09",
        egressEscalationRate: "0",
      } satisfies CloudScenarioInput,
    ],
    ...overrides,
  };
}

describe("analyzeSensitivity", () => {
  it("returns base comparison and cases", () => {
    const base = makeComparison();
    const cases: SensitivityCase[] = [
      {
        id: "higher-energy",
        label: "Higher Energy",
        comparison: makeComparison({
          id: "test-comp",
          scenarios: [
            {
              ...(base.scenarios[0] as OwnedScenarioInput),
              annualEnergyKwh: "480",
            },
            base.scenarios[1]!,
          ],
        }),
      },
    ];

    const result = analyzeSensitivity(base, cases);
    expect(result.base).toBeDefined();
    expect(result.cases).toHaveLength(1);
    expect("result" in result.cases[0]!).toBe(true);
  });

  it("handles case validation errors gracefully", () => {
    const base = makeComparison();
    const cases: SensitivityCase[] = [
      {
        id: "bad-case",
        label: "Bad Case",
        comparison: { ...base, currency: "EUR" },
      },
    ];

    const result = analyzeSensitivity(base, cases);
    expect(result.base).toBeDefined();
    expect(result.cases).toHaveLength(1);
    expect("error" in result.cases[0]!).toBe(true);
  });

  it("always has a base comparison even when all cases fail", () => {
    const base = makeComparison();
    const cases: SensitivityCase[] = [
      {
        id: "bad-case",
        label: "Bad Case",
        comparison: { ...base, currency: "EUR" },
      },
    ];

    const result = analyzeSensitivity(base, cases);
    expect(result.base).toBeDefined();
    expect(result.base.scenarios).toHaveLength(2);
  });

  it("returns recommendation on result", () => {
    const base = makeComparison();
    const result = analyzeSensitivity(base, []);
    expect(result.recommendation).toBeDefined();
    expect(result.recommendation.code).toMatch(
      /^(cost-favors-|too-close-to-call|sensitivity-dependent)/,
    );
  });

  it("preserves case order", () => {
    const base = makeComparison();
    const cases: SensitivityCase[] = [
      {
        id: "case-a",
        label: "Case A",
        comparison: makeComparison({
          scenarios: [
            { ...(base.scenarios[0] as OwnedScenarioInput), annualEnergyKwh: "480" },
            base.scenarios[1]!,
          ],
        }),
      },
      {
        id: "case-b",
        label: "Case B",
        comparison: makeComparison({
          scenarios: [
            { ...(base.scenarios[0] as OwnedScenarioInput), annualEnergyKwh: "120" },
            base.scenarios[1]!,
          ],
        }),
      },
    ];

    const result = analyzeSensitivity(base, cases);
    expect(result.cases).toHaveLength(2);
    if ("result" in result.cases[0]!) {
      expect(result.cases[0].id).toBe("case-a");
    }
    if ("result" in result.cases[1]!) {
      expect(result.cases[1].id).toBe("case-b");
    }
  });
});
