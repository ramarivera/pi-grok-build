import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

function runPi(args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync("pi", args, {
    cwd: repoRoot,
    env,
    encoding: "utf-8",
    timeout: 240_000,
    maxBuffer: 5_000_000,
  });
}

describe("pi-grok-build real Pi runtime e2e", () => {
  it("prints visible text through pi -p", () => {
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

  it("prints visible text through selectable ACP mode", () => {
    const stdout = runPi([...piArgs, "Respond exactly PI_GROK_OK and nothing else."], {
      ...process.env,
      PI_GROK_BUILD_MODE: "acp",
    });

    assert.ok(stdout.includes(PI_OK), stdout);
  });
});
