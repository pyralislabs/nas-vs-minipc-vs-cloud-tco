import { describe, it, expect } from "vitest";
import { formatMoney } from "../../src/format/money.js";
import { InputValidationError } from "../../src/core/errors.js";

describe("formatMoney", () => {
  it("formats USD with default locale (en-US)", () => {
    expect(formatMoney("1234.5", "USD")).toBe("$1,234.50");
  });

  it("formats JPY with default locale", () => {
    expect(formatMoney("1000", "JPY")).toBe("¥1,000.00");
  });

  it("formats EUR with de-DE locale", () => {
    expect(formatMoney("1234.5", "EUR", "de-DE")).toMatch(/1\.234,50/);
  });

  it("formats JPY with ja-JP locale", () => {
    expect(formatMoney("1000", "JPY", "ja-JP")).toMatch(/1,000/);
  });

  it("throws InputValidationError with locale: code for unsupported locale", () => {
    expect(() => formatMoney("100", "USD", "xx-XX")).toThrow(InputValidationError);
    try {
      formatMoney("100", "USD", "xx-XX");
    } catch (err) {
      const e = err as InputValidationError;
      expect(e.issues[0]?.code).toBe("locale:unsupported");
    }
  });

  it("throws RangeError for non-finite string values", () => {
    expect(() => formatMoney("Infinity", "USD")).toThrow(RangeError);
    expect(() => formatMoney("NaN", "USD")).toThrow(RangeError);
  });
});
