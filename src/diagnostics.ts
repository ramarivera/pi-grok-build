import pino from "pino";

export type GrokDiagnosticLevel = "silent" | "error" | "warn" | "info" | "debug" | "trace";

export type GrokFailureKind =
  | "missing_cli"
  | "invalid_model"
  | "auth"
  | "timeout"
  | "subprocess"
  | "parse"
  | "unknown";

export interface GrokFailureDiagnostic {
  kind: GrokFailureKind;
  message: string;
  exitCode?: number | null | undefined;
  stderr?: string | undefined;
  stdout?: string | undefined;
}

export class GrokCliError extends Error {
  readonly kind: GrokFailureKind;
  readonly exitCode?: number | null | undefined;
  readonly stderr?: string | undefined;
  readonly stdout?: string | undefined;

  constructor(diagnostic: GrokFailureDiagnostic, options?: { cause?: unknown }) {
    super(diagnostic.message, options);
    this.name = "GrokCliError";
    this.kind = diagnostic.kind;
    this.exitCode = diagnostic.exitCode;
    this.stderr = diagnostic.stderr;
    this.stdout = diagnostic.stdout;
  }
}

const DEFAULT_LEVEL: GrokDiagnosticLevel = "error";
const LEVELS = new Set<GrokDiagnosticLevel>([
  "silent",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
]);

function readDiagnosticLevel(): GrokDiagnosticLevel {
  const raw = process.env.PI_GROK_BUILD_LOG_LEVEL?.toLowerCase();
  if (raw && LEVELS.has(raw as GrokDiagnosticLevel)) {
    return raw as GrokDiagnosticLevel;
  }
  if (process.env.PI_GROK_BUILD_DEBUG === "1" || process.env.PI_GROK_BUILD_DEBUG === "true") {
    return "debug";
  }
  return DEFAULT_LEVEL;
}

const logger = pino({
  name: "pi-grok-build",
  level: readDiagnosticLevel() === "silent" ? "fatal" : readDiagnosticLevel(),
  enabled: readDiagnosticLevel() !== "silent",
  base: null,
});

type Fields = Record<string, unknown>;
type LazyFields = Fields | (() => Fields);

function resolveFields(fields?: LazyFields): Fields | undefined {
  if (!fields) return undefined;
  return typeof fields === "function" ? fields() : fields;
}

export function createDiagnostics(component: string) {
  const child = logger.child({ component });
  return {
    error(message: string, fields?: LazyFields): void {
      if (child.isLevelEnabled("error")) child.error(resolveFields(fields), message);
    },
    warn(message: string, fields?: LazyFields): void {
      if (child.isLevelEnabled("warn")) child.warn(resolveFields(fields), message);
    },
    info(message: string, fields?: LazyFields): void {
      if (child.isLevelEnabled("info")) child.info(resolveFields(fields), message);
    },
    debug(message: string, fields?: LazyFields): void {
      if (child.isLevelEnabled("debug")) child.debug(resolveFields(fields), message);
    },
    trace(message: string, fields?: LazyFields): void {
      if (child.isLevelEnabled("trace")) child.trace(resolveFields(fields), message);
    },
  };
}

export function redactGrokArgs(args: readonly string[]): string[] {
  const redacted: string[] = [];
  let redactNext = false;
  for (const arg of args) {
    if (redactNext) {
      redacted.push("<redacted>");
      redactNext = false;
      continue;
    }
    redacted.push(arg);
    if (arg === "-p" || arg === "--prompt-json" || arg === "--system-prompt-override") {
      redactNext = true;
    }
  }
  return redacted;
}

export function classifyGrokFailure(input: {
  message?: string | undefined;
  stderr?: string | undefined;
  stdout?: string | undefined;
  exitCode?: number | null | undefined;
}): GrokFailureDiagnostic {
  const combined = [input.message, input.stderr, input.stdout].filter(Boolean).join("\n");
  const lower = combined.toLowerCase();

  if (lower.includes("enoent") || lower.includes("not found on path") || lower.includes("command not found")) {
    return {
      kind: "missing_cli",
      message:
        "Grok Build CLI not found on PATH. Install/authenticate Grok CLI and make `grok` available in the Pi runtime PATH.",
      exitCode: input.exitCode,
      stderr: input.stderr,
      stdout: input.stdout,
    };
  }

  if (lower.includes("unknown model id") || lower.includes("model") && lower.includes("not found")) {
    return {
      kind: "invalid_model",
      message: combined || "Grok CLI rejected the selected model.",
      exitCode: input.exitCode,
      stderr: input.stderr,
      stdout: input.stdout,
    };
  }

  if (lower.includes("auth") || lower.includes("login") || lower.includes("unauthorized")) {
    return {
      kind: "auth",
      message: combined || "Grok CLI is not authenticated. Run `grok` once interactively to authenticate.",
      exitCode: input.exitCode,
      stderr: input.stderr,
      stdout: input.stdout,
    };
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return {
      kind: "timeout",
      message: combined || "Grok CLI timed out.",
      exitCode: input.exitCode,
      stderr: input.stderr,
      stdout: input.stdout,
    };
  }

  if (input.exitCode != null && input.exitCode !== 0) {
    return {
      kind: "subprocess",
      message: combined || `Grok CLI exited with code ${input.exitCode}.`,
      exitCode: input.exitCode,
      stderr: input.stderr,
      stdout: input.stdout,
    };
  }

  return {
    kind: "unknown",
    message: combined || "Unknown Grok CLI failure.",
    exitCode: input.exitCode,
    stderr: input.stderr,
    stdout: input.stdout,
  };
}

export function formatGrokFailure(input: GrokFailureDiagnostic): string {
  const prefix = (() => {
    switch (input.kind) {
      case "missing_cli":
        return "Grok CLI missing";
      case "invalid_model":
        return "Grok model error";
      case "auth":
        return "Grok authentication error";
      case "timeout":
        return "Grok timeout";
      case "parse":
        return "Grok stream parse error";
      case "subprocess":
        return "Grok subprocess error";
      default:
        return "Grok CLI error";
    }
  })();

  return `${prefix}: ${input.message}`;
}
