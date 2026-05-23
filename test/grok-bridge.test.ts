import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGrokEventBridge } from "../src/grok-bridge.ts";

// Minimal mock stream that captures pushed events
function createMockStream() {
  const events: Array<{ type: string }> = [];
  return {
    events,
    push: (e: { type: string }) => events.push(e),
    end: () => events.push({ type: "stream_end" }),
  };
}

// Minimal mock model
function createMockModel(id = "grok-3") {
  return {
    id,
    provider: "xai",
    cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
  } as any;
}

describe("createGrokEventBridge", () => {
  it("emits start on first event", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      delta: { type: "text_delta", text: "H" },
      index: 0,
    });

    assert.equal(stream.events[0]?.type, "start");
  });

  it("accumulates text deltas", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      delta: { type: "text_delta", text: "Hello " },
      index: 0,
    });
    bridge.handleStreamEvent({
      type: "assistant",
      delta: { type: "text_delta", text: "world" },
      index: 0,
    });

    const output = bridge.getOutput();
    assert.equal(output.content.length, 1);
    assert.equal((output.content[0] as any).text, "Hello world");
  });

  it("handles full content blocks", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Full text" }],
      },
    });

    const output = bridge.getOutput();
    assert.equal(output.content.length, 1);
    assert.equal((output.content[0] as any).text, "Full text");
  });

  it("handles thinking blocks", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "thinking", thinking: "planning...", signature: "sig" }],
      },
    });

    const output = bridge.getOutput();
    assert.equal(output.content.length, 1);
    assert.equal((output.content[0] as any).thinking, "planning...");
  });

  it("handles tool_use blocks", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "read", id: "tool_1", input: { path: "/tmp" } }],
      },
    });

    const output = bridge.getOutput();
    assert.equal(output.content.length, 1);
    const toolCall = output.content[0] as any;
    assert.equal(toolCall.type, "toolCall");
    assert.equal(toolCall.name, "read");
    assert.equal(toolCall.id, "tool_1");
    assert.deepEqual(toolCall.arguments, { path: "/tmp" });
  });

  it("applies usage stats", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 },
      },
    });

    const output = bridge.getOutput();
    assert.equal(output.usage.input, 10);
    assert.equal(output.usage.output, 5);
    assert.equal(output.usage.cacheRead, 2);
  });

  it("maps stop_reason tool_use to toolUse", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      delta: { stop_reason: "tool_use" },
    });

    assert.equal(bridge.getOutput().stopReason, "toolUse");
  });

  it("maps stop_reason max_tokens to length", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      delta: { stop_reason: "max_tokens" },
    });

    assert.equal(bridge.getOutput().stopReason, "length");
  });

  it("defaults unknown stop reasons to stop", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      delta: { stop_reason: "end_turn" },
    });

    assert.equal(bridge.getOutput().stopReason, "stop");
  });

  it("handles input_json_delta for streaming tool calls", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    // Start a tool_use block via full content
    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "write", id: "t1", input: {} }],
      },
    });

    // Stream partial JSON
    bridge.handleStreamEvent({
      type: "assistant",
      delta: { type: "input_json_delta", partial_json: '{"path":"/tmp"}' },
      index: 0,
    });

    const output = bridge.getOutput();
    const toolCall = output.content[0] as any;
    assert.deepEqual(toolCall.arguments, { path: "/tmp" });
  });

  it("handles partial JSON without crashing", () => {
    const stream = createMockStream();
    const bridge = createGrokEventBridge(stream as any, createMockModel());

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "write", id: "t1", input: {} }],
      },
    });

    bridge.handleStreamEvent({
      type: "assistant",
      delta: { type: "input_json_delta", partial_json: '{"incomplete": ' },
      index: 0,
    });

    // Should not crash; arguments remain empty object
    const output = bridge.getOutput();
    const toolCall = output.content[0] as any;
    assert.ok(toolCall.arguments);
  });
});
