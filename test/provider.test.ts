import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildGrokPrompt,
  contextHasImages,
  buildSpawnOptions,
} from "../src/provider.ts";

describe("buildGrokPrompt", () => {
  it("builds prompt with user messages", () => {
    const result = buildGrokPrompt({
      messages: [{ role: "user", content: "Hello" }],
    });
    assert.ok(result.includes("USER:"));
    assert.ok(result.includes("Hello"));
  });

  it("builds prompt with assistant messages", () => {
    const result = buildGrokPrompt({
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: [{ type: "text", text: "Hello there" }] },
      ],
    });
    assert.ok(result.includes("USER:"));
    assert.ok(result.includes("ASSISTANT:"));
    assert.ok(result.includes("Hello there"));
  });

  it("builds prompt with tool results", () => {
    const result = buildGrokPrompt({
      messages: [
        { role: "user", content: "Search" },
        {
          role: "toolResult",
          content: "Found 3 results",
          toolName: "grep",
        },
      ],
    });
    assert.ok(result.includes("TOOL RESULT (grep):"));
    assert.ok(result.includes("Found 3 results"));
  });

  it("handles empty messages", () => {
    const result = buildGrokPrompt({ messages: [] });
    assert.equal(result, "");
  });

  it("handles image content as placeholder", () => {
    const result = buildGrokPrompt({
      messages: [
        { role: "user", content: [{ type: "image", data: "base64..." }] },
      ],
    });
    assert.ok(result.includes("[Image]"));
  });

  it("ignores thinking blocks", () => {
    const result = buildGrokPrompt({
      messages: [
        {
          role: "assistant",
          content: [{ type: "thinking", thinking: "secret" }],
        },
      ],
    });
    assert.ok(!result.includes("secret"));
  });

  it("serializes tool calls", () => {
    const result = buildGrokPrompt({
      messages: [
        {
          role: "assistant",
          content: [
            { type: "toolCall", name: "read", arguments: { path: "/tmp" } },
          ],
        },
      ],
    });
    assert.ok(result.includes("Tool call: read"));
    assert.ok(result.includes('"path":"/tmp"'));
  });
});

describe("contextHasImages", () => {
  it("returns false for text-only messages", () => {
    const result = contextHasImages({
      messages: [{ role: "user", content: "Hello" }],
    });
    assert.equal(result, false);
  });

  it("returns false for empty content array", () => {
    const result = contextHasImages({
      messages: [{ role: "user", content: [] }],
    });
    assert.equal(result, false);
  });

  it("returns true when an image block is present", () => {
    const result = contextHasImages({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            { type: "image", data: "base64...", mimeType: "image/png" },
          ],
        },
      ],
    });
    assert.equal(result, true);
  });

  it("returns true when image is in assistant content", () => {
    const result = contextHasImages({
      messages: [
        {
          role: "assistant",
          content: [{ type: "image", data: "base64..." }],
        },
      ],
    });
    assert.equal(result, true);
  });

  it("returns true with mixed blocks", () => {
    const result = contextHasImages({
      messages: [
        { role: "user", content: [{ type: "text", text: "Hi" }] },
        {
          role: "user",
          content: [
            { type: "image", data: "abc" },
            { type: "text", text: "Describe" },
          ],
        },
      ],
    });
    assert.equal(result, true);
  });
});

describe("buildSpawnOptions", () => {
  it("sets modelId and alwaysApprove by default", () => {
    const model = { id: "grok-3", provider: "xai" } as any;
    const opts = buildSpawnOptions(model, {});
    assert.equal(opts.modelId, "grok-3");
    assert.equal(opts.alwaysApprove, true);
  });

  it("passthroughs advanced options", () => {
    const model = { id: "grok-3", provider: "xai" } as any;
    const opts = buildSpawnOptions(model, {
      effort: "high",
      maxTurns: 7,
      reasoningEffort: "medium",
      check: true,
      bestOfN: 2,
      verbatim: true,
      disableWebSearch: true,
      noSubagents: true,
      noPlan: true,
      noMemory: true,
      experimentalMemory: true,
      permissionMode: "auto",
      rules: "Be brief",
      systemPromptOverride: "You are a test",
      tools: "read",
      disallowedTools: "write",
      allowRules: ["edit:*"],
      denyRules: ["exec:*"],
      sandbox: "strict",
      workingDirectory: "/tmp",
      continueSession: true,
      sessionId: "sess-1",
    });
    assert.equal(opts.effort, "high");
    assert.equal(opts.maxTurns, 7);
    assert.equal(opts.reasoningEffort, "medium");
    assert.equal(opts.check, true);
    assert.equal(opts.bestOfN, 2);
    assert.equal(opts.verbatim, true);
    assert.equal(opts.disableWebSearch, true);
    assert.equal(opts.noSubagents, true);
    assert.equal(opts.noPlan, true);
    assert.equal(opts.noMemory, true);
    assert.equal(opts.experimentalMemory, true);
    assert.equal(opts.permissionMode, "auto");
    assert.equal(opts.rules, "Be brief");
    assert.equal(opts.systemPromptOverride, "You are a test");
    assert.equal(opts.tools, "read");
    assert.equal(opts.disallowedTools, "write");
    assert.deepEqual(opts.allowRules, ["edit:*"]);
    assert.deepEqual(opts.denyRules, ["exec:*"]);
    assert.equal(opts.sandbox, "strict");
    assert.equal(opts.workingDirectory, "/tmp");
    assert.equal(opts.continueSession, true);
    assert.equal(opts.sessionId, "sess-1");
  });
});
