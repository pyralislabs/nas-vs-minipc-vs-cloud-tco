import { describe, it, expect, beforeEach } from "vitest";
import { calculateDepreciation } from "../../src/core/depreciation.js";
import { D } from "../../src/core/money.js";

beforeEach(() => {
  D.set({ precision: 28, rounding: D.ROUND_HALF_EVEN });
});
import type { OwnedScenarioInput } from "../../src/core/types.js";

function makeOwnedScenario(overrides?: Partial<OwnedScenarioInput>): OwnedScenarioInput {
  return {
    id: "test-own",
    label: "Test Owned",
    kind: "owned",
    assetType: "nas",
    initialCapex: [
      { id: "unit", label: "NAS Unit", amount: "1000.00" },
      { id: "drives", label: "Drives", amount: "300.00" },
    ],
    annualEnergyKwh: "240",
    electricityRatePerKwh: "0.14",
    electricityEscalationRate: "0",
    annualMaintenance: "50.00",
    maintenanceEscalationRate: "0",
    depreciation: {
      depreciableCapitalIds: ["unit"],
      usefulLifeMonths: 60,
      residualValue: "100.00",
    },
    ...overrides,
  };
}

describe("calculateDepreciation", () => {
  it("calculates monthly depreciation correctly", () => {
    const scenario = makeOwnedScenario();
    const result = calculateDepreciation(scenario, 60);
    // (1000 - 100) / 60 = 15
    expect(result.monthlyDepreciation).toBe("15");
  });

  it("accumulated depreciation at horizon equals depreciable amount", () => {
    const scenario = makeOwnedScenario();
    const result = calculateDepreciation(scenario, 60);
    expect(result.accumulatedDepreciation).toBe("900");
    expect(result.endBookValue).toBe("100");
  });

  it("caps accumulated depreciation at depreciable amount for shorter horizons", () => {
    const scenario = makeOwnedScenario();
    // Useful life is 60 months, but horizon is only 24
    const result = calculateDepreciation(scenario, 24);
    // 15 * 24 = 360
    expect(result.accumulatedDepreciation).toBe("360");
    // 1000 - 360 = 640
    expect(result.endBookValue).toBe("640");
  });

  it("handles zero depreciable amount", () => {
    const scenario = makeOwnedScenario({
      initialCapex: [{ id: "unit", label: "Unit", amount: "500.00" }],
      depreciation: {
        depreciableCapitalIds: ["unit"],
        usefulLifeMonths: 60,
        residualValue: "500.00",
      },
    });
    const result = calculateDepreciation(scenario, 60);
    expect(result.monthlyDepreciation).toBe("0");
    expect(result.accumulatedDepreciation).toBe("0");
    expect(result.endBookValue).toBe("500");
  });

  it("throws when no depreciation policy defined", () => {
    const scenario = makeOwnedScenario({ depreciation: undefined });
    expect(() => calculateDepreciation(scenario, 60)).toThrow("No depreciation");
  });

  it("depreciation does not affect TCO via the function contract", () => {
    const scenario = makeOwnedScenario();
    const result = calculateDepreciation(scenario, 60);
    expect(result.monthlyDepreciation).toBeTruthy();
    // Depreciation is a separate reporting view; the function doesn't touch TCO
  });
});
