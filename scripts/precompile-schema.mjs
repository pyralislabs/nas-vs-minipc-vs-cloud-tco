#!/usr/bin/env node

/**
 * Precompiles scenario.schema.json into a standalone validator function
 * using Ajv standalone mode. The output is imported by the widget so the
 * full Ajv runtime is never bundled into the widget build.
 *
 * Usage: node scripts/precompile-schema.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const schemaPath = resolve(__dirname, "../src/schema/scenario.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

  const Ajv = (await import("ajv")).default;
  const standaloneCode = (await import("ajv/dist/standalone/index.js")).default;

  const ajv = new Ajv({
    schemas: [schema],
    code: { source: true },
    validateSchema: false,
  });

  const validate = ajv.getSchema("urn:tco:scenario");
  if (!validate) {
    throw new Error("Schema compilation failed: validate function not found");
  }

  const moduleCode = standaloneCode(ajv, validate);

  const outDir = resolve(__dirname, "../src/schema");
  const outPath = resolve(outDir, "validator.precompiled.mjs");

  mkdirSync(outDir, { recursive: true });
  // The standalone output uses module.exports; convert to ESM default export
  const esmCode = moduleCode.replace(
    /module\.exports\s*=\s*(\w+);module\.exports\.default\s*=\s*\1;/,
    "export default $1;",
  );
  writeFileSync(outPath, esmCode, "utf-8");

  console.log(`Precompiled validator written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
