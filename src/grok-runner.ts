/**
 * Process manager for spawning and managing Grok Build CLI subprocesses.
 *
 * Handles the full subprocess lifecycle: spawn with correct CLI flags,
 * write prompts via stdin (ACP mode), capture stdout/stderr, force-kill,
 * and startup validation for CLI presence and authentication.
 */

import spawn from "cross-spawn";
import { execSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { GrokRunResult, GrokSpawnOptions } from "./types.ts";

/** Known grok CLI binary names to try. */
const GROK_BINARIES = ["grok"] as const;

/** Detect the installed grok binary on PATH. */
function detectGrokBinary(): string {
  for (const bin of GROK_BINARIES) {
    try {
      execSync(`command -v ${bin}`, { stdio: "pipe", timeout: 5000 });
      return bin;
    } catch {
      continue;
    }
  }
  throw new Error(
    "Grok Build CLI not found. Install it:\n" +
      "  curl -fsSL https://x.ai/cli/install.sh | bash\n" +
      "Then authenticate via 'grok' (first launch opens browser).",
  );
}

/**
 * Spawn a Grok CLI subprocess in one-shot headless mode.
 *
 * Uses `grok -p "prompt" --output-format streaming-json` to send a prompt
 * and receive streaming JSON events on stdout.
 *
 * @param prompt - The prompt text to send
 * @param options - Optional cwd, AbortSignal, model, session settings
 * @returns The spawned ChildProcess with piped stdin/stdout/stderr
 */
export function spawnGrok(
  prompt: string,
  options: GrokSpawnOptions = {},
): ChildProcess {
  const binary = detectGrokBinary();
  const args: string[] = [
    "-p",
    prompt,
    "--output-format",
    "streaming-json",
  ];

  if (options.modelId) {
    args.push("--model", options.modelId);
  }

  if (options.sessionId) {
    args.push("--session-id", options.sessionId);
  }

  if (options.resumeSessionId) {
    args.push("--resume", options.resumeSessionId);
  }

  if (options.alwaysApprove) {
    args.push("--always-approve");
  }

  const proc = spawn(binary, args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      // Grok uses GROK_CODE_XAI_API_KEY for non-browser auth
      ...(process.env.GROK_CODE_XAI_API_KEY ? {} : {}),
    },
  });

  return proc as ChildProcess;
}

/**
 * Validate that the Grok CLI is installed and on PATH.
 * Throws with install instructions if not found.
 */
export function validateGrokPresence(): void {
  detectGrokBinary();
}

/**
 * Check if Grok CLI is authenticated.
 * Returns true/false — does not throw.
 */
export function validateGrokAuth(): boolean {
  try {
    const binary = detectGrokBinary();
    execSync(`${binary} --version`, { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the Grok CLI version string.
 * Returns "unknown" if not installed or command fails.
 */
export function getGrokVersion(): string {
  try {
    const binary = detectGrokBinary();
    return execSync(`${binary} --version`, {
      stdio: "pipe",
      timeout: 5000,
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

/**
 * Run a raw Grok CLI command and capture the output.
 * Used by the grok_run tool for arbitrary grok commands.
 *
 * @param args - Arguments to pass to grok
 * @param options - Optional cwd and timeout
 * @returns Structured result with stdout, stderr, exit code
 */
export function runGrokCommand(
  args: string[],
  options: { cwd?: string; timeout?: number } = {},
): GrokRunResult {
  const binary = detectGrokBinary();
  const maxOutput = 500_000; // 500KB limit

  try {
    const stdout = execSync(`${binary} ${args.join(" ")}`, {
      cwd: options.cwd ?? process.cwd(),
      timeout: options.timeout ?? 120_000,
      maxBuffer: maxOutput,
      stdio: "pipe",
      encoding: "utf-8",
    });

    const text = stdout.toString();
    return {
      ok: true,
      exitCode: 0,
      stdout: text.length > maxOutput ? text.slice(0, maxOutput) : text,
      stderr: "",
      truncated: text.length > maxOutput,
    };
  } catch (err: unknown) {
    const execErr = err as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      status?: number;
      message?: string;
    };

    const stdout =
      typeof execErr.stdout === "string"
        ? execErr.stdout
        : execErr.stdout?.toString() ?? "";
    const stderr =
      execErr.stderr?.toString() ?? execErr.message ?? "Unknown error";

    return {
      ok: false,
      exitCode: execErr.status ?? 1,
      stdout: stdout.slice(0, maxOutput),
      stderr: stderr.slice(0, maxOutput),
      truncated: stdout.length > maxOutput || stderr.length > maxOutput,
    };
  }
}

/**
 * Run `grok inspect` and return the parsed config.
 * Grok inspect shows discovered config, instructions, skills, plugins, hooks, MCP servers.
 */
export function runGrokInspect(
  options: { cwd?: string } = {},
): GrokRunResult {
  return runGrokCommand(["inspect"], options);
}

/** Registry of active subprocesses for cleanup on teardown. */
const activeProcesses = new Set<ChildProcess>();

/**
 * Register a subprocess in the global process registry.
 * Auto-removed when the process exits.
 */
export function registerProcess(proc: ChildProcess): void {
  activeProcesses.add(proc);
  proc.on("exit", () => activeProcesses.delete(proc));
}

/**
 * Force-kill a subprocess via SIGKILL (no-op if already dead).
 */
export function forceKillProcess(proc: ChildProcess): void {
  if (proc.killed || proc.exitCode !== null) return;
  proc.kill("SIGKILL");
}

/**
 * Force-kill all registered subprocesses.
 */
export function killAllProcesses(): void {
  for (const proc of activeProcesses) {
    forceKillProcess(proc);
  }
  activeProcesses.clear();
}

/**
 * Attach stderr listener and accumulate output.
 * Returns a function that returns the accumulated stderr string.
 */
export function captureStderr(proc: ChildProcess): () => string {
  let buffer = "";
  proc.stderr?.on("data", (data: Buffer) => {
    buffer += data.toString();
  });
  return () => buffer;
}
