import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { describe, it } from "node:test";

const PI_OK = "PI_GROK_OK";
const repoRoot = process.cwd();
const piArgs = [
  "--no-extensions",
  "--extension",
  ".pi/extensions/pi-grok-build/index.ts",
  "--model",
  "pi-grok-build/grok-build",
  "-p",
  "--no-session",
  "--no-context-files",
] as const;

const piJsonArgs = [
  "--no-extensions",
  "--extension",
  ".pi/extensions/pi-grok-build/index.ts",
  "--mode",
  "json",
  "--model",
  "pi-grok-build/grok-build",
  "-p",
  "--no-session",
  "--no-context-files",
] as const;

const piRpcArgs = [
  "--no-extensions",
  "--extension",
  ".pi/extensions/pi-grok-build/index.ts",
  "--mode",
  "rpc",
  "--model",
  "pi-grok-build/grok-build",
  "--no-session",
  "--no-context-files",
] as const;

function runPi(args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync("pi", args, {
    cwd: repoRoot,
    env,
    encoding: "utf-8",
    timeout: 240_000,
    maxBuffer: 5_000_000,
  });
}

async function runPiRpcPrompt(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("pi", [...piRpcArgs], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(`timed out waiting for RPC response\nstdout:\n${stdout}\nstderr:\n${stderr}`),
      );
    }, 240_000);

    const cleanup = () => clearTimeout(timeout);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        try {
          const event = JSON.parse(trimmed) as { type?: string; message?: unknown; data?: unknown };
          if (event.type === "turn_end" && JSON.stringify(event).includes(PI_OK)) {
            cleanup();
            child.kill("SIGTERM");
            resolve(stdout);
          }
        } catch {
          // Ignore partial JSONL frames until more stdout arrives.
        }
      }
    });

    child.on("error", (error) => {
      cleanup();
      reject(error);
    });

    child.on("exit", (code, signal) => {
      cleanup();
      if (code !== 0 && signal !== "SIGTERM") {
        reject(
          new Error(`RPC Pi exited with ${code ?? signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`),
        );
      }
    });

    child.stdin.write(`${JSON.stringify({ id: "prompt-1", type: "prompt", message })}\n`);
  });
}

describe("pi-grok-build real Pi runtime e2e", () => {
  it("prints visible text through default ACP mode in pi -p", () => {
    const stdout = runPi([...piArgs, "Respond exactly PI_GROK_OK and nothing else."]);

    assert.ok(stdout.includes(PI_OK), stdout);
  });

  it("emits parseable JSON events containing visible text through pi --mode json -p", () => {
    const stdout = runPi([...piJsonArgs, "Respond exactly PI_GROK_OK and nothing else."]);

    const events = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    assert.ok(events.length > 0, stdout);
    assert.ok(stdout.includes(PI_OK), stdout);
    assert.ok(
      events.some((event) => event.type === "message_end" || event.type === "turn_end"),
      "expected terminal message/turn event",
    );
  });

  it("prints visible text through selectable JSONL fallback mode", () => {
    const stdout = runPi([...piArgs, "Respond exactly PI_GROK_OK and nothing else."], {
      ...process.env,
      PI_GROK_BUILD_MODE: "jsonl",
    });

    assert.ok(stdout.includes(PI_OK), stdout);
  });

  it("emits RPC JSONL events containing visible text through pi --mode rpc", async () => {
    const stdout = await runPiRpcPrompt("Respond exactly PI_GROK_OK and nothing else.");

    assert.ok(stdout.includes(PI_OK), stdout);
    assert.ok(stdout.includes('"type":"turn_end"'), stdout);
  });
});
