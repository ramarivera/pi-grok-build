import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("pi-grok-build e2e", () => {
  it("local .pi shim exports a default function", async () => {
    const mod = await import("../.pi/extensions/pi-grok-build/index.ts");
    assert.ok(mod);
    assert.equal(typeof mod.default, "function");
  });
});
