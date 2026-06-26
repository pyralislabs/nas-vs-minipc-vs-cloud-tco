import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const cliPath = resolve(import.meta.dirname, "../../dist/cli/main.js");
const examplesDir = resolve(import.meta.dirname, "../../examples");
const goldenDir = resolve(import.meta.dirname, "../golden");

function buildIfNeeded(): void {
  if (!existsSync(cliPath)) {
    execSync("pnpm build:package", { cwd: resolve(import.meta.dirname, "../..") });
  }
}

function getCliOutput(exampleFile: string): string {
  return execSync(`node ${cliPath} compare --input ${examplesDir}/${exampleFile}`, {
    encoding: "utf-8",
    timeout: 10000,
  });
}

describe("Golden fixture regression", () => {
  beforeAll(() => {
    buildIfNeeded();
  });

  it("homelab golden matches CLI output byte-for-byte", () => {
    const actual = getCliOutput("homelab-nas-vs-cloud.json");
    const golden = readFileSync(`${goldenDir}/homelab.txt`, "utf-8");
    expect(actual).toBe(golden);
  });

  it("local-ai golden matches CLI output byte-for-byte", () => {
    const actual = getCliOutput("local-ai-box-vs-cloud-gpu.json");
    const golden = readFileSync(`${goldenDir}/local-ai.txt`, "utf-8");
    expect(actual).toBe(golden);
  });
});
