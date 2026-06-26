import { Command } from "commander";
import { readFileSync } from "node:fs";
import { stat } from "node:fs/promises";

import { validateInputSize } from "../schema/validate.js";
import { validateLocale } from "../schema/validate.js";

const program = new Command();

program
  .name("tco-compare")
  .description("Multi-year TCO comparison for NAS, mini PC, and cloud services")
  .version("0.0.0");

program
  .command("compare")
  .description("Run a full TCO comparison")
  .requiredOption("-i, --input <path>", "Input JSON file path or '-' for stdin")
  .option("--json", "Emit JSON output")
  .option("--locale <locale>", "Display locale (default: en-US)")
  .option("--links", "Include contextual backlinks in human output");

program
  .command("sensitivity")
  .description("Run a comparison with sensitivity cases")
  .requiredOption("-i, --input <path>", "Input JSON file path or '-' for stdin")
  .requiredOption("-c, --cases <path>", "Sensitivity cases JSON file path or '-' for stdin")
  .option("--json", "Emit JSON output")
  .option("--locale <locale>", "Display locale (default: en-US)")
  .option("--links", "Include contextual backlinks in human output");

program
  .command("validate")
  .description("Validate a comparison input file")
  .requiredOption("-i, --input <path>", "Input JSON file path or '-' for stdin")
  .option("--json", "Emit JSON output");

export interface ParsedArgs {
  command: string;
  input: string;
  casesInput: string | undefined;
  json: boolean;
  locale: string;
  links: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  program.parse(argv, { from: "user" });

  const commandName = program.args[0];
  if (!commandName) {
    program.outputHelp();
    throw new CliInputError("cli:no-command", "No command specified");
  }

  const cmd = program.commands.find((c) => c.name() === commandName);
  if (!cmd) {
    throw new CliInputError("cli:unknown-command", `Unknown command: ${commandName}`);
  }

  const opts = cmd.opts();

  return {
    command: commandName,
    input: opts.input as string,
    casesInput: opts.cases as string | undefined,
    json: opts.json === true,
    locale: (opts.locale as string) ?? "en-US",
    links: opts.links === true,
  };
}

export async function readInput(path: string): Promise<string> {
  if (path === "-") {
    return readStdin();
  }

  try {
    const stats = await stat(path);
    validateInputSize(stats.size, "cli");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CliInputError("cli:input", `File not found`);
    }
    if ((err as NodeJS.ErrnoException).code === "EACCES") {
      throw new CliInputError("cli:input", `Permission denied`);
    }
    throw err;
  }

  return readFileSync(path, "utf-8");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const limit = 1_048_576;

  for await (const chunk of process.stdin) {
    const buf = Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > limit + 1) {
      throw new CliInputError(
        "limits:input-size",
        `Input exceeds 1 MiB limit (${totalBytes} bytes)`,
      );
    }
    chunks.push(buf);
  }

  validateInputSize(totalBytes, "cli");
  return Buffer.concat(chunks).toString("utf-8");
}

export function validateCliLocale(locale: string | undefined): void {
  if (locale) {
    validateLocale(locale);
  }
}

export class CliInputError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CliInputError";
    this.code = code;
  }
}
