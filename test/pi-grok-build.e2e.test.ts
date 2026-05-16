import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("pi-grok-build e2e", () => {
  it("local .pi shim exports the extension", () => {
    const mod = require("../.pi/extensions/pi-grok-build/index.ts") as Record<string, unknown>;
    assert.ok(mod);
    assert.equal(typeof mod.default, "function");
  });
});
