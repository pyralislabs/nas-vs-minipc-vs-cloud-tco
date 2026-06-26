import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateComparisonInput, validateInputSize } from "../../src/schema/validate.js";
import { InputValidationError } from "../../src/core/errors.js";

const fixtureDir = resolve(import.meta.dirname, "../fixtures");

function loadJson(file: string): unknown {
  return JSON.parse(readFileSync(`${fixtureDir}/${file}`, "utf-8"));
}

describe("validateComparisonInput", () => {
  it("accepts valid homelab input", () => {
    const input = loadJson("valid/homelab.json");
    const result = validateComparisonInput(input);
    expect(result.id).toBe("homelab-nas-vs-cloud");
  });

  it("accepts valid local-ai input", () => {
    const input = loadJson("valid/local-ai.json");
    const result = validateComparisonInput(input);
    expect(result.id).toBe("local-ai-vs-cloud-gpu");
  });

  describe("error code coverage", () => {
    it("schema:pattern for negative amount", () => {
      try {
        validateComparisonInput(loadJson("invalid/negative-cost.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code.startsWith("schema:"))).toBe(true);
        expect(err.issues.some((i) => i.path.startsWith("/"))).toBe(true);
      }
    });

    it("money:unsupported-currency for unknown currency", () => {
      try {
        validateComparisonInput(loadJson("invalid/mixed-currency.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "money:unsupported-currency")).toBe(true);
      }
    });

    it("id:duplicate-scenario for duplicate IDs", () => {
      try {
        validateComparisonInput(loadJson("invalid/duplicate-scenario-id.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "id:duplicate-scenario")).toBe(true);
      }
    });

    it("scope:missing-owned when no owned scenario", () => {
      // Use 2 cloud scenarios to pass schema's minItems=2 but fail semantic
      const input = loadJson("valid/homelab.json") as Record<string, unknown>;
      const cloudSc = (input.scenarios as Array<Record<string, unknown>>)[1];
      input.scenarios = [cloudSc, { ...cloudSc, id: "cloud-2", label: "Cloud 2" }];
      try {
        validateComparisonInput(input);
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "scope:missing-owned")).toBe(true);
      }
    });

    it("scope:missing-cloud when no cloud scenario", () => {
      // Use 2 owned scenarios to pass schema's minItems=2 but fail semantic
      const input = loadJson("valid/homelab.json") as Record<string, unknown>;
      const ownedSc = (input.scenarios as Array<Record<string, unknown>>)[0];
      input.scenarios = [ownedSc, { ...ownedSc, id: "nas-2", label: "NAS 2" }];
      try {
        validateComparisonInput(input);
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "scope:missing-cloud")).toBe(true);
      }
    });

    it("scope:too-few-scenarios schema rejection (<2)", () => {
      try {
        validateComparisonInput(loadJson("invalid/too-few-scenarios.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code.startsWith("schema:"))).toBe(true);
      }
    });

    it("scope:too-many-scenarios schema rejection (>5)", () => {
      try {
        validateComparisonInput(loadJson("invalid/too-many-scenarios.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code.startsWith("schema:"))).toBe(true);
      }
    });

    it("time:scheduled-month for month > horizon", () => {
      try {
        validateComparisonInput(loadJson("invalid/scheduled-month-outside.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "time:scheduled-month")).toBe(true);
      }
    });

    it("pricebasis:non-zero-escalation for constant price with escalation", () => {
      try {
        validateComparisonInput(loadJson("invalid/non-zero-escalation-constant.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "pricebasis:non-zero-escalation")).toBe(true);
      }
    });

    it("capital:unknown-id for depreciation referencing non-existent capital", () => {
      try {
        validateComparisonInput(loadJson("invalid/unknown-capital-id.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "capital:unknown-id")).toBe(true);
      }
    });

    it("capital:residual-exceeds-basis", () => {
      try {
        validateComparisonInput(loadJson("invalid/residual-exceeds-basis.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "capital:residual-exceeds-basis")).toBe(true);
      }
    });

    it("salvage:exceeds-cap", () => {
      try {
        validateComparisonInput(loadJson("invalid/salvage-exceeds-capex.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "salvage:exceeds-cap")).toBe(true);
      }
    });

    it("salvage schema rejects negative values", () => {
      // The schema pattern rejects negative salvage before semantic checks fire
      const input = loadJson("valid/homelab.json") as Record<string, unknown>;
      const scenarios = input.scenarios as Array<Record<string, unknown>>;
      const owned = scenarios.find((s) => s.kind === "owned") as Record<string, unknown>;
      owned.salvageValue = "-50.00";
      try {
        validateComparisonInput(input);
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        // Schema pattern rejection
        expect(err.issues.some((i) => i.code.startsWith("schema:"))).toBe(true);
      }
    });

    it("materiality:out-of-range for materiality outside 0..100", () => {
      try {
        validateComparisonInput(loadJson("invalid/materiality-out-of-range.json"));
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code === "materiality:out-of-range")).toBe(true);
      }
    });

    it("non-kebab-case IDs are rejected by schema", () => {
      const input = loadJson("valid/homelab.json") as Record<string, unknown>;
      const scenarios = input.scenarios as Array<Record<string, unknown>>;
      (scenarios[0] as Record<string, unknown>).id = "Invalid_ID!";
      try {
        validateComparisonInput(input);
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        expect(err.issues.some((i) => i.code.startsWith("schema:"))).toBe(true);
      }
    });

    it("issues have string paths in JSON Pointer format", () => {
      const input = loadJson("valid/homelab.json") as Record<string, unknown>;
      const scenarios = input.scenarios as Array<Record<string, unknown>>;
      const cloudSc = scenarios[1];
      input.scenarios = [cloudSc, { ...cloudSc, id: "cloud-2", label: "Cloud 2" }];
      try {
        validateComparisonInput(input);
        expect.unreachable("should have thrown");
      } catch (e) {
        const err = e as InputValidationError;
        for (const issue of err.issues) {
          expect(issue.path).toMatch(/^\/([\w-]+\/)*[\w-]+$/);
        }
      }
    });
  });
});

describe("validateInputSize", () => {
  it("rejects CLI input at 1 MiB + 1 byte", () => {
    expect(() => validateInputSize(1_048_577, "cli")).toThrow(InputValidationError);
  });

  it("accepts CLI input at exactly 1 MiB", () => {
    expect(() => validateInputSize(1_048_576, "cli")).not.toThrow();
  });

  it("rejects widget input at 256 KiB + 1 byte", () => {
    expect(() => validateInputSize(262_145, "widget")).toThrow(InputValidationError);
  });

  it("accepts widget input at exactly 256 KiB", () => {
    expect(() => validateInputSize(262_144, "widget")).not.toThrow();
  });
});
