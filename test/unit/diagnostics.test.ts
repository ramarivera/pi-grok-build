import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyGrokFailure,
  formatGrokFailure,
  redactGrokArgs,
} from "../../src/diagnostics.ts";

describe("redactGrokArgs", () => {
  it("redacts inline prompts and prompt JSON without changing argv shape", () => {
    const args = [
      "-p",
      "secret prompt",
      "--model",
      "grok-build",
      "--prompt-json",
      "{\"secret\":true}",
      "--system-prompt-override",
      "system secret",
    ];

    assert.deepEqual(redactGrokArgs(args), [
      "-p",
      "<redacted>",
      "--model",
      "grok-build",
      "--prompt-json",
      "<redacted>",
      "--system-prompt-override",
      "<redacted>",
    ]);
  });
});

describe("classifyGrokFailure", () => {
  it("classifies missing CLI failures", () => {
    const diagnostic = classifyGrokFailure({ message: "spawnSync grok ENOENT" });
    assert.equal(diagnostic.kind, "missing_cli");
    assert.match(formatGrokFailure(diagnostic), /Grok CLI missing/);
  });

  it("classifies invalid model failures", () => {
    const diagnostic = classifyGrokFailure({
      stderr: "Couldn't set model 'grok-4.3': Invalid params: unknown model id",
      exitCode: 1,
    });
    assert.equal(diagnostic.kind, "invalid_model");
    assert.match(formatGrokFailure(diagnostic), /Grok model error/);
  });

  it("classifies auth failures", () => {
    const diagnostic = classifyGrokFailure({ stderr: "not authenticated, please login" });
    assert.equal(diagnostic.kind, "auth");
    assert.match(formatGrokFailure(diagnostic), /Grok authentication error/);
  });

  it("classifies non-zero exits as subprocess failures", () => {
    const diagnostic = classifyGrokFailure({ exitCode: 2, stderr: "bad flag" });
    assert.equal(diagnostic.kind, "subprocess");
    assert.match(formatGrokFailure(diagnostic), /Grok subprocess error/);
  });
});
