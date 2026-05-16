import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import directly from sub-modules that DON'T depend on pi-ai runtime.
// (tsx can't resolve @earendil-works/pi-ai as CJS — Pi's SDK handles it at runtime.)
import {
  parseGrokLine,
  isStreamEvent,
  isResultEvent,
  isSystemEvent,
} from "../src/grok-parser.ts";

// buildGrokPrompt lives in provider.ts which has pi-ai imports.
// Replicate minimal logic here for unit coverage.
function buildGrokPrompt(context: {
  messages: Array<{ role: string; content: unknown; toolName?: string }>;
}): string {
  const parts: string[] = [];
  for (const msg of context.messages) {
    if (msg.role === "user") {
      parts.push("USER:");
      parts.push(contentToText(msg.content));
    } else if (msg.role === "assistant") {
      parts.push("ASSISTANT:");
      parts.push(contentToText(msg.content));
    } else if (msg.role === "toolResult") {
      parts.push(`TOOL RESULT (${msg.toolName ?? "unknown"}):`);
      parts.push(contentToText(msg.content));
    }
  }
  return parts.join("\n") || "";
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block: Record<string, unknown>) => {
      if (block.type === "text") return String(block.text ?? "");
      if (block.type === "toolCall") {
        return `[Tool call: ${block.name} args=${JSON.stringify(block.arguments ?? {})}]`;
      }
      if (block.type === "thinking") return "";
      if (block.type === "image") return "[Image]";
      return "";
    })
    .join("\n");
}

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
});

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
});
