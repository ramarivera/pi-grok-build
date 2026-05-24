import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import directly from sub-modules that DON'T depend on pi-ai runtime.
// (tsx can't resolve @earendil-works/pi-ai as CJS — Pi's SDK handles it at runtime.)
import {
  parseGrokLine,
  isStreamEvent,
  isResultEvent,
  isSystemEvent,
} from "../../src/grok-parser.ts";

describe("GrokBuildOptions contract", () => {
  it("accepts commandName and toolNamePrefix", () => {
    const opts: { commandName?: string; toolNamePrefix?: string } = {
      commandName: "test-grok",
      toolNamePrefix: "test_",
    };
    assert.equal(opts.commandName, "test-grok");
    assert.equal(opts.toolNamePrefix, "test_");
  });

  it("defaults to undefined", () => {
    const opts: { commandName?: string; toolNamePrefix?: string } = {};
    assert.equal(opts.commandName, undefined);
    assert.equal(opts.toolNamePrefix, undefined);
  });
});

describe("parseGrokLine", () => {
  it("returns null for empty lines", () => {
    assert.equal(parseGrokLine(""), null);
    assert.equal(parseGrokLine("   "), null);
  });

  it("returns null for non-JSON lines", () => {
    assert.equal(parseGrokLine("debug output here"), null);
    assert.equal(parseGrokLine("[not an object]"), null);
  });

  it("returns null for JSON arrays", () => {
    assert.equal(parseGrokLine("[]"), null);
    assert.equal(parseGrokLine("[1, 2, 3]"), null);
  });

  it("parses stream event JSON", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      },
    });
    const msg = parseGrokLine(line);
    assert.ok(msg);
    assert.equal(msg.type, "assistant");
    assert.ok(isStreamEvent(msg));
    assert.equal(isResultEvent(msg), false);
  });

  it("parses result event JSON", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      result: "done",
    });
    const msg = parseGrokLine(line);
    assert.ok(msg);
    assert.equal(msg.type, "result");
    assert.ok(isResultEvent(msg));
  });

  it("parses system event JSON", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      message: "Session started",
    });
    const msg = parseGrokLine(line);
    assert.ok(msg);
    assert.equal(msg.type, "system");
    assert.ok(isSystemEvent(msg));
  });

  it("returns null for malformed JSON", () => {
    assert.equal(parseGrokLine("{broken json"), null);
  });

  it("returns null for JSON primitives", () => {
    assert.equal(parseGrokLine("123"), null);
    assert.equal(parseGrokLine('"string"'), null);
    assert.equal(parseGrokLine("true"), null);
  });

  it("returns null for JSON null", () => {
    assert.equal(parseGrokLine("null"), null);
  });

  it("parses deeply nested stream events", () => {
    const line = JSON.stringify({
      type: "assistant",
      delta: {
        type: "text_delta",
        text: "chunk",
        stop_reason: "end_turn",
      },
      index: 0,
    });
    const msg = parseGrokLine(line);
    assert.ok(msg);
    assert.equal((msg as any).delta.type, "text_delta");
    assert.equal((msg as any).delta.text, "chunk");
  });
});

describe("isStreamEvent / isResultEvent / isSystemEvent", () => {
  it("classifies correctly", () => {
    const stream = { type: "assistant" } as any;
    const result = { type: "result" } as any;
    const system = { type: "system" } as any;
    const unknown = { type: "unknown" } as any;

    assert.equal(isStreamEvent(stream), true);
    assert.equal(isResultEvent(stream), false);
    assert.equal(isSystemEvent(stream), false);

    assert.equal(isStreamEvent(result), false);
    assert.equal(isResultEvent(result), true);
    assert.equal(isSystemEvent(result), false);

    assert.equal(isStreamEvent(system), false);
    assert.equal(isResultEvent(system), false);
    assert.equal(isSystemEvent(system), true);

    assert.equal(isStreamEvent(unknown), false);
    assert.equal(isResultEvent(unknown), false);
    assert.equal(isSystemEvent(unknown), false);
  });
});
