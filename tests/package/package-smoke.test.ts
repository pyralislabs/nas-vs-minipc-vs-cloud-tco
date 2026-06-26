import { describe, it, expect } from "vitest";

describe("Package smoke test", () => {
  it("public API exports the documented symbols with correct shape", async () => {
    const lib = await import("../../src/index.js");

    expect(typeof lib.calculateComparison).toBe("function");
    expect(lib.calculateComparison.length).toBe(1);

    expect(typeof lib.calculateBreakEven).toBe("function");
    expect(lib.calculateBreakEven.length).toBe(2);

    expect(typeof lib.calculateDepreciation).toBe("function");
    expect(lib.calculateDepreciation.length).toBe(2);

    expect(typeof lib.analyzeSensitivity).toBe("function");
    expect(lib.analyzeSensitivity.length).toBe(2);

    expect(typeof lib.formatMoney).toBe("function");
    expect(lib.formatMoney.length).toBe(3);

    expect(typeof lib.InputValidationError).toBe("function");
    expect(typeof lib.SchemaVersionError).toBe("function");

    expect(typeof lib.validateComparisonInput).toBe("function");
    expect(typeof lib.validateSensitivityInput).toBe("function");
    expect(typeof lib.validateLocale).toBe("function");
  });

  it("exports the documented type symbols (compile-time check)", async () => {
    const lib = await import("../../src/index.js");
    const exportedKeys = Object.keys(lib).sort();
    expect(exportedKeys).toEqual(
      [
        "InputValidationError",
        "SchemaVersionError",
        "analyzeSensitivity",
        "calculateBreakEven",
        "calculateComparison",
        "calculateDepreciation",
        "formatMoney",
        "validateComparisonInput",
        "validateLocale",
        "validateSensitivityInput",
      ].sort(),
    );
  });
});
