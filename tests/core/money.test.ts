import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { parseMoney, serializeMoney, decimalFromNumber, D } from "../../src/core/money.js";

beforeEach(() => {
  D.set({ precision: 28, rounding: D.ROUND_HALF_EVEN });
});

describe("money", () => {
  describe("parseMoney", () => {
    it("parses integer string", () => {
      const d = parseMoney("42");
      expect(d.toString()).toBe("42");
    });

    it("parses decimal string", () => {
      const d = parseMoney("12.34");
      expect(d.toString()).toBe("12.34");
    });

    it("parses zero", () => {
      const d = parseMoney("0");
      expect(d.toString()).toBe("0");
    });
  });

  describe("serializeMoney", () => {
    it("serializes integer without trailing zeros", () => {
      expect(serializeMoney(parseMoney("1.0000"))).toBe("1");
    });

    it("serializes decimal with trimmed trailing zeros", () => {
      expect(serializeMoney(parseMoney("1.5000"))).toBe("1.5");
    });

    it("serializes zero", () => {
      expect(serializeMoney(parseMoney("0"))).toBe("0");
    });

    it("round-trips through parse and serialize", () => {
      const inputs = ["0", "1", "1.5", "100.25", "0.001", "999999.99"];
      for (const input of inputs) {
        const d = parseMoney(input);
        const s = serializeMoney(d);
        const d2 = parseMoney(s);
        const s2 = serializeMoney(d2);
        expect(s).toBe(s2);
      }
    });

    it("rejects Infinity", () => {
      // Dividing by 0 in decimal.js returns Infinity
      expect(() => serializeMoney(parseMoney("1").div(parseMoney("0")))).toThrow(RangeError);
    });

    it("rejects Infinity from arithmetic", () => {
      const inf = new D(1).div(new D(0));
      expect(() => serializeMoney(inf)).toThrow(RangeError);
    });
  });

  describe("decimalFromNumber", () => {
    it("creates decimal from number", () => {
      const d = decimalFromNumber(42);
      expect(serializeMoney(d)).toBe("42");
    });
  });

  describe("property: serialize round-trip", () => {
    it("round-trips a sample of decimal strings", () => {
      const arb = fc
        .oneof(
          fc.integer({ min: -1_000_000, max: 1_000_000 }).map((n) => n.toFixed()),
          fc
            .tuple(fc.integer({ min: -1_000_000, max: 1_000_000 }), fc.integer({ min: 0, max: 8 }))
            .map(([whole, frac]) => {
              const fracStr = frac === 0 ? "" : "." + "0".repeat(frac) + "1";
              return `${whole}${fracStr}`;
            }),
        )
        .filter((s) => /^-?(0|[1-9]\d*)(\.\d{1,8})?$/.test(s));
      fc.assert(
        fc.property(arb, (s) => {
          const d = parseMoney(s);
          const out = serializeMoney(d);
          const reparsed = parseMoney(out);
          expect(serializeMoney(reparsed)).toBe(out);
          expect(out).not.toMatch(/e/i);
        }),
        { numRuns: 200 },
      );
    });
  });
});
