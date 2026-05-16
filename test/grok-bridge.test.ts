import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AssistantMessageEventStream, Model } from "@earendil-works/pi-ai";
import { createGrokEventBridge, type GrokEventBridge } from "../src/grok-bridge.ts";
import type { GrokStreamEvent } from "../src/types.ts";

/** Create a minimal mock model for bridge testing. */
function mockModel(): Model<any> {
  return {
    id: "grok-4.1",
    name: "Grok 4.1",
    provider: "xai",
    input: ["text"],
    contextWindow: 1_000_000,
    maxTokens: 128_000,
    reasoning: true,
    cost: { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 0 },
  } as Model<any>;
}

/** Create a bridge with a recording stream to inspect pushed events. */
function createRecordingBridge(): {
  bridge: GrokEventBridge;
  events: Array<{ type: string; [key: string]: unknown }>;
} {
  const events: Array<{ type: string; [key: string]: unknown }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = {
    push(event: { type: string; [key: string]: unknown }) {
      events.push(event);
    },
    end() {},
  } as unknown as AssistantMessageEventStream;

  const bridge = createGrokEventBridge(stream, mockModel());
  return { bridge, events };
}

describe("createGrokEventBridge", () => {
  it("emits start event on first stream event", () => {
    const { bridge, events } = createRecordingBridge();

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Hello" }],
      },
    });

    assert.ok(events.some((e) => e.type === "start"));
  });

  it("handles text content blocks", () => {
    const { bridge, events } = createRecordingBridge();

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Hi there" }],
      },
    });

    assert.ok(events.some((e) => e.type === "text_start"));
    assert.ok(events.some((e) => e.type === "text_end"));
    assert.ok(events.some(
      (e) => e.type === "text_delta" && e.delta === "Hi there",
    ));
  });

  it("handles thinking content blocks", () => {
    const { bridge, events } = createRecordingBridge();

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "thinking", thinking: "Let me think..." }],
      },
    });

    assert.ok(events.some((e) => e.type === "thinking_start"));
    assert.ok(events.some((e) => e.type === "thinking_end"));
  });

  it("handles tool use content blocks", () => {
    const { bridge, events } = createRecordingBridge();

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "read",
            id: "tool_1",
            input: { path: "/tmp/test.txt" },
          },
        ],
      },
    });

    assert.ok(events.some((e) => e.type === "toolcall_start"));
    assert.ok(events.some((e) => e.type === "toolcall_end"));
  });

  it("handles stream deltas for text", () => {
    const { bridge, events } = createRecordingBridge();

    // First start a text block
    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "" }],
      },
      index: 0,
    });

    // Then send deltas
    bridge.handleStreamEvent({
      type: "assistant",
      delta: { type: "text_delta", text: "Hello " },
      index: 0,
    });

    bridge.handleStreamEvent({
      type: "assistant",
      delta: { type: "text_delta", text: "World" },
      index: 0,
    });

    const output = bridge.getOutput();
    const textContent = output.content.find((c) => c.type === "text");
    assert.ok(textContent);
    assert.equal((textContent as { text: string }).text, "Hello World");
  });

  it("handles stop reason", () => {
    const { bridge } = createRecordingBridge();

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Done" }],
        stop_reason: "end_turn",
      },
    });

    const output = bridge.getOutput();
    assert.equal(output.stopReason, "stop");
  });

  it("handles tool_use stop reason", () => {
    const { bridge } = createRecordingBridge();

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "calling tool" }],
        stop_reason: "tool_use",
      },
    });

    const output = bridge.getOutput();
    assert.equal(output.stopReason, "toolUse");
  });

  it("accumulates usage from stream events", () => {
    const { bridge } = createRecordingBridge();

    bridge.handleStreamEvent({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Test" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    });

    const output = bridge.getOutput();
    assert.equal(output.usage.input, 100);
    assert.equal(output.usage.output, 50);
  });

  it("getOutput returns valid AssistantMessage even without events", () => {
    const { bridge } = createRecordingBridge();
    const output = bridge.getOutput();
    assert.equal(output.role, "assistant");
    assert.ok(Array.isArray(output.content));
    assert.equal(output.stopReason, "stop");
  });
});
