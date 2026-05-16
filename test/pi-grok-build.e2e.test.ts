import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * E2E: verify the public API surface of pi-grok-build.
 *
 * Direct import of the .pi shim or extension.ts triggers pi-ai CJS
 * resolution in tsx (known limitation — Pi's DefaultResourceLoader handles
 * this at Pi SDK runtime, as used by pi-goal's e2e tests). These tests
 * verify what's verifiable without a full Pi SDK session.
 */

describe("pi-grok-build e2e — public API", () => {
  it("grok-parser exports all expected functions", async () => {
    const mod = await import("../src/grok-parser.ts");
    assert.equal(typeof mod.parseGrokLine, "function");
    assert.equal(typeof mod.isStreamEvent, "function");
    assert.equal(typeof mod.isResultEvent, "function");
    assert.equal(typeof mod.isSystemEvent, "function");
  });

  it("grok-runner exports all expected functions", async () => {
    const mod = await import("../src/grok-runner.ts");
    assert.equal(typeof mod.spawnGrok, "function");
    assert.equal(typeof mod.runGrokCommand, "function");
    assert.equal(typeof mod.runGrokInspect, "function");
    assert.equal(typeof mod.validateGrokPresence, "function");
    assert.equal(typeof mod.validateGrokAuth, "function");
    assert.equal(typeof mod.getGrokVersion, "function");
  });

  it("grok-bridge exports createGrokEventBridge", async () => {
    const mod = await import("../src/grok-bridge.ts");
    assert.equal(typeof mod.createGrokEventBridge, "function");
  });

  it("types module exports expected type interfaces (loads cleanly)", async () => {
    const mod = await import("../src/types.ts");
    // Type interfaces don't produce runtime values, just verify module loads
    assert.ok(mod);
  });

  it(".pi shim file exists on disk", () => {
    // Verify the file exists (structural check; full SDK load requires Pi runtime)
    assert.ok(existsSync(".pi/extensions/pi-grok-build/index.ts"));
  });
});
