import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runGrokModels, spawnGrok, validateGrokAuth } from "../../src/grok-runner.ts";

function withPath<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const oldPath = process.env.PATH;
  process.env.PATH = path;
  return fn().finally(() => {
    process.env.PATH = oldPath;
  });
}

describe("spawnGrok", () => {
  it("starts the provider process without running a synchronous --version preflight", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-grok-build-runner-"));
    const grokPath = join(dir, "grok");
    const logPath = join(dir, "argv.log");
    writeFileSync(
      grokPath,
      `#!/bin/sh
printf '%s\\n' "$*" >> ${JSON.stringify(logPath)}
if [ "$1" = "--version" ]; then
  sleep 10
  exit 0
fi
printf '%s\\n' '{"type":"text","data":"PI_GROK_OK"}'
printf '%s\\n' '{"type":"end","stopReason":"EndTurn"}'
`,
    );
    chmodSync(grokPath, 0o755);

    await withPath(dir, async () => {
      const proc = spawnGrok("hello", { modelId: "grok-build" });
      let stdout = "";

      proc.stdout?.setEncoding("utf8");
      proc.stdout?.on("data", (chunk) => {
        stdout += chunk;
      });

      const exitCode = await new Promise<number | null>((resolve, reject) => {
        proc.once("error", reject);
        proc.once("close", resolve);
      });

      assert.equal(exitCode, 0);
      assert.match(stdout, /PI_GROK_OK/);
      const invocations = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
      assert.doesNotMatch(invocations, /--version/);
    });
  });
});

describe("runGrokModels", () => {
  it("runs `grok models` without a synchronous --version preflight", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-grok-build-models-"));
    const grokPath = join(dir, "grok");
    const logPath = join(dir, "argv.log");
    writeFileSync(
      grokPath,
      `#!/bin/sh
printf '%s\\n' "$*" >> ${JSON.stringify(logPath)}
if [ "$1" = "--version" ]; then
  echo 'version probe should not run' >&2
  exit 88
fi
if [ "$1" = "models" ]; then
  printf '%s\\n' 'Available models:'
  printf '%s\\n' '  * grok-build (default)'
  exit 0
fi
exit 2
`,
    );
    chmodSync(grokPath, 0o755);

    await withPath(dir, async () => {
      const result = runGrokModels();

      assert.equal(result.ok, true);
      assert.match(result.stdout, /grok-build/);
      const invocations = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
      assert.doesNotMatch(invocations, /--version/);
      assert.match(invocations, /^models$/m);
    });
  });
});

describe("validateGrokAuth", () => {
  it("checks auth with `grok models` without a synchronous --version preflight", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-grok-build-auth-"));
    const grokPath = join(dir, "grok");
    const logPath = join(dir, "argv.log");
    writeFileSync(
      grokPath,
      `#!/bin/sh
printf '%s\\n' "$*" >> ${JSON.stringify(logPath)}
if [ "$1" = "--version" ]; then
  echo 'version probe should not run' >&2
  exit 88
fi
if [ "$1" = "models" ]; then
  printf '%s\\n' 'Available models:'
  printf '%s\\n' '  * grok-build (default)'
  exit 0
fi
exit 2
`,
    );
    chmodSync(grokPath, 0o755);

    await withPath(dir, async () => {
      assert.equal(validateGrokAuth(), true);
      const invocations = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
      assert.doesNotMatch(invocations, /--version/);
      assert.match(invocations, /^models$/m);
    });
  });
});
