import { describe, it, expect } from "vitest";

describe("Widget scaffold", () => {
  it("module exports expected functions", async () => {
    const widget = await import("../../src/widget/main.js");
    expect(widget.createWidget).toBeDefined();
    expect(widget.mountWidgets).toBeDefined();
  });
});
