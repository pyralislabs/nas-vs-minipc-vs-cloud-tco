import { describe, it, expect, beforeEach } from "vitest";
import { classifyRecommendation } from "../../src/core/recommendation.js";
import { D } from "../../src/core/money.js";
import type { ScenarioResult } from "../../src/core/types.js";

beforeEach(() => {
  D.set({ precision: 28, rounding: D.ROUND_HALF_EVEN });
});

function makeScenario(id: string, netTco: string, kind: "owned" | "cloud"): ScenarioResult {
  return {
    id,
    label: id,
    kind,
    grossCashTco: netTco,
    netCashTco: netTco,
    salvageValue: "0",
    monthlyCashFlows: [],
  };
}

describe("classifyRecommendation", () => {
  it("classifies cost-favors-owned when owned is cheaper", () => {
    const owned = makeScenario("my-nas", "1000", "owned");
    const cloud = makeScenario("cloud-svc", "2000", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("cost-favors-owned");
    expect(result.explanation).toContain("owning is lower cost");
  });

  it("classifies cost-favors-cloud when cloud is cheaper", () => {
    const owned = makeScenario("my-nas", "2000", "owned");
    const cloud = makeScenario("cloud-svc", "1000", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("cost-favors-cloud");
    expect(result.explanation).toContain("cloud rental is lower cost");
  });

  it("classifies too-close-to-call when both are zero", () => {
    const owned = makeScenario("my-nas", "0", "owned");
    const cloud = makeScenario("cloud-svc", "0", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("too-close-to-call");
  });

  it("classifies too-close-to-call when difference is below materiality", () => {
    const owned = makeScenario("my-nas", "1000", "owned");
    const cloud = makeScenario("cloud-svc", "1050", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("too-close-to-call");
  });

  it("classifies cost-favors when diff exceeds materiality", () => {
    const owned = makeScenario("my-nas", "1000", "owned");
    const cloud = makeScenario("cloud-svc", "1200", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("cost-favors-owned");
  });

  it("one-zero: [0, x] favors owned", () => {
    const owned = makeScenario("my-nas", "0", "owned");
    const cloud = makeScenario("cloud-svc", "1000", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("cost-favors-owned");
  });

  it("one-zero: [x, 0] favors cloud", () => {
    const owned = makeScenario("my-nas", "1000", "owned");
    const cloud = makeScenario("cloud-svc", "0", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("cost-favors-cloud");
  });

  it("equal TCOs classify too-close-to-call", () => {
    const owned = makeScenario("my-nas", "500", "owned");
    const cloud = makeScenario("cloud-svc", "500", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("too-close-to-call");
  });

  it("diff exactly at materiality threshold is too-close-to-call", () => {
    const owned = makeScenario("my-nas", "1000", "owned");
    const cloud = makeScenario("cloud-svc", "1100", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("too-close-to-call");
  });

  it("diff just above materiality favors lower cost", () => {
    const owned = makeScenario("my-nas", "1000", "owned");
    const cloud = makeScenario("cloud-svc", "1101", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.code).toBe("cost-favors-owned");
  });

  it("includes disclaimer in result", () => {
    const owned = makeScenario("my-nas", "1000", "owned");
    const cloud = makeScenario("cloud-svc", "2000", "cloud");
    const result = classifyRecommendation(owned, cloud, "10", []);
    expect(result.disclaimer).toContain("cost-only");
  });
});
