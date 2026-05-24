import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGrokAcpArgs,
  parseGrokIntegrationMode,
  resolveGrokIntegrationMode,
} from "../../src/acp-mode.ts";

describe("parseGrokIntegrationMode", () => {
  it("defaults to jsonl when unset", () => {
    assert.equal(parseGrokIntegrationMode(undefined), "jsonl");
    assert.equal(parseGrokIntegrationMode(""), "jsonl");
  });

  it("accepts jsonl and acp case-insensitively", () => {
    assert.equal(parseGrokIntegrationMode("jsonl"), "jsonl");
    assert.equal(parseGrokIntegrationMode("ACP"), "acp");
  });

  it("rejects unknown modes", () => {
    assert.throws(() => parseGrokIntegrationMode("best-of-n"), /Invalid Grok integration mode/);
  });
});

describe("resolveGrokIntegrationMode", () => {
  it("prefers PI_GROK_BUILD_MODE over the compatibility env var", () => {
    assert.equal(
      resolveGrokIntegrationMode({
        PI_GROK_BUILD_MODE: "acp",
        PI_GROK_BUILD_INTEGRATION_MODE: "jsonl",
      }),
      "acp",
    );
  });

  it("supports PI_GROK_BUILD_INTEGRATION_MODE as a compatibility alias", () => {
    assert.equal(resolveGrokIntegrationMode({ PI_GROK_BUILD_INTEGRATION_MODE: "acp" }), "acp");
  });
});

describe("buildGrokAcpArgs", () => {
  it("builds the boring always-approved stdio ACP command", () => {
    assert.deepEqual(buildGrokAcpArgs({ modelId: "grok-build" }), [
      "agent",
      "--no-leader",
      "--always-approve",
      "--model",
      "grok-build",
      "stdio",
    ]);
  });

  it("passes reasoning effort at process start", () => {
    assert.deepEqual(buildGrokAcpArgs({ modelId: "grok-build", reasoningEffort: "high" }), [
      "agent",
      "--no-leader",
      "--always-approve",
      "--model",
      "grok-build",
      "--reasoning-effort",
      "high",
      "stdio",
    ]);
  });

  it("can omit always-approve only for targeted tests", () => {
    assert.deepEqual(buildGrokAcpArgs({ modelId: "grok-build", alwaysApprove: false }), [
      "agent",
      "--no-leader",
      "--model",
      "grok-build",
      "stdio",
    ]);
  });
});
