import { describe, it, expect, beforeEach } from "vitest";
import { calculateComparison } from "../../src/core/calculate.js";
import { D } from "../../src/core/money.js";

beforeEach(() => {
  D.set({ precision: 28, rounding: D.ROUND_HALF_EVEN });
});
import type {
  ComparisonInput,
  OwnedScenarioInput,
  CloudScenarioInput,
} from "../../src/core/types.js";

function makeComparison(overrides?: Partial<ComparisonInput>): ComparisonInput {
  return {
    schemaVersion: 1,
    id: "test-comp",
    label: "Test Comparison",
    baseDate: "2026-01-01",
    currency: "USD",
    priceBasis: "constant",
    horizonMonths: 60,
    materialityThresholdPercent: "10",
    scenarios: [
      {
        id: "test-nas",
        label: "Test NAS",
        kind: "owned",
        assetType: "nas",
        initialCapex: [{ id: "unit", label: "NAS Unit", amount: "800.00" }],
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
          { id: "compute", label: "Compute", monthlyAmount: "15.00", annualEscalationRate: "0" },
        ],
        monthlyEgressGb: "50",
        egressRatePerGb: "0.09",
        egressEscalationRate: "0",
      } satisfies CloudScenarioInput,
    ],
    ...overrides,
  };
}

describe("calculateComparison", () => {
  it("returns correct structure", () => {
    const input = makeComparison();
    const result = calculateComparison(input);

    expect(result.schemaVersion).toBe(1);
    expect(result.scenarios).toHaveLength(2);
    expect(result.pairBreakEvens).toHaveLength(1);
    expect(result.recommendation.code).toBeDefined();
  });

  it("initial capex appears at month 0 only", () => {
    const input = makeComparison();
    const result = calculateComparison(input);
    const ownedResult = result.scenarios.find((s) => s.kind === "owned")!;
    const flow0 = ownedResult.monthlyCashFlows.find((f) => f.month === 0)!;
    expect(flow0.capitalCost).toBe("800");
    expect(flow0.recurringCost).toBe("0");
    expect(flow0.scheduledCost).toBe("0");

    const flow1 = ownedResult.monthlyCashFlows.find((f) => f.month === 1)!;
    expect(flow1.capitalCost).toBe("0");
  });

  it("capitalCost is 0 for months > 0", () => {
    const input = makeComparison();
    const result = calculateComparison(input);
    const ownedResult = result.scenarios.find((s) => s.kind === "owned")!;
    for (const flow of ownedResult.monthlyCashFlows) {
      if (flow.month > 0) {
        expect(flow.capitalCost).toBe("0");
      }
    }
  });

  it("grossCashTco equals sum of capital + recurring + scheduled", () => {
    const input = makeComparison();
    const result = calculateComparison(input);
    for (const scenario of result.scenarios) {
      let sum = 0n;
      for (const flow of scenario.monthlyCashFlows) {
        sum += BigInt(Math.round(Number(flow.capitalCost) * 100));
        sum += BigInt(Math.round(Number(flow.recurringCost) * 100));
        sum += BigInt(Math.round(Number(flow.scheduledCost) * 100));
      }
      const expectedDollars = Number(sum) / 100;
      expect(Number(scenario.grossCashTco)).toBeCloseTo(expectedDollars, 0);
    }
  });

  it("owned net TCO equals gross minus salvage", () => {
    const input = makeComparison();
    (input.scenarios[0] as OwnedScenarioInput).salvageValue = "100.00";
    const result = calculateComparison(input);
    const ownedResult = result.scenarios.find((s) => s.kind === "owned")!;
    const gross = Number(ownedResult.grossCashTco);
    const net = Number(ownedResult.netCashTco);
    expect(net).toBeCloseTo(gross - 100, 0);
  });

  it("cloud net equals cloud gross", () => {
    const input = makeComparison();
    const result = calculateComparison(input);
    const cloudResult = result.scenarios.find((s) => s.kind === "cloud")!;
    expect(cloudResult.netCashTco).toBe(cloudResult.grossCashTco);
  });

  it("scheduled costs appear only in their declared month", () => {
    const input = makeComparison();
    (input.scenarios[0] as OwnedScenarioInput).scheduledCosts = [
      { id: "disk-replace", label: "Disk replacement", amount: "120.00", month: 24 },
    ];
    const result = calculateComparison(input);
    const ownedResult = result.scenarios.find((s) => s.kind === "owned")!;

    const month24 = ownedResult.monthlyCashFlows.find((f) => f.month === 24)!;
    expect(month24.scheduledCost).toBe("120");
    expect(month24.capitalCost).toBe("0");

    const month23 = ownedResult.monthlyCashFlows.find((f) => f.month === 23)!;
    expect(month23.scheduledCost).toBe("0");
  });

  it("escalation changes at month 13", () => {
    const input = makeComparison();
    (input.scenarios[1] as CloudScenarioInput).monthlyRecurring[0]!.annualEscalationRate = "0.1";
    const result = calculateComparison(input);
    const cloudResult = result.scenarios.find((s) => s.kind === "cloud")!;

    const m1 = cloudResult.monthlyCashFlows.find((f) => f.month === 1)!;
    const m13 = cloudResult.monthlyCashFlows.find((f) => f.month === 13)!;
    const m25 = cloudResult.monthlyCashFlows.find((f) => f.month === 25)!;

    const baseAmount = 15.0;
    expect(Number(m1.recurringCost)).toBeCloseTo(baseAmount + 50 * 0.09, 1);
    // At month 13, 10% escalation applies: base * 1.1^1
    expect(Number(m13.recurringCost)).toBeCloseTo(baseAmount * 1.1 + 50 * 0.09, 1);
    // At month 25, 10% escalation applies: base * 1.1^2
    expect(Number(m25.recurringCost)).toBeCloseTo(baseAmount * 1.21 + 50 * 0.09, 1);
  });

  it("returns scenarios in input order", () => {
    const input = makeComparison();
    const result = calculateComparison(input);
    expect(result.scenarios[0]!.id).toBe(input.scenarios[0]!.id);
    expect(result.scenarios[1]!.id).toBe(input.scenarios[1]!.id);
  });

  it("recommendation disclaimer is always present", () => {
    const input = makeComparison();
    const result = calculateComparison(input);
    expect(result.recommendation.disclaimer).toBeTruthy();
    expect(result.recommendation.disclaimer).toContain("cost-only");
  });

  it("handles nominal price basis with escalation", () => {
    const input = makeComparison({ priceBasis: "nominal" });
    (input.scenarios[0] as OwnedScenarioInput).electricityEscalationRate = "0.03";
    const result = calculateComparison(input);
    const ownedResult = result.scenarios.find((s) => s.kind === "owned")!;
    expect(ownedResult.monthlyCashFlows.length).toBe(61);
    expect(ownedResult.grossCashTco).toBeTruthy();
  });
});
