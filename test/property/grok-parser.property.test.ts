import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";
import {
  isEndEvent,
  isErrorEvent,
  isTextEvent,
  isThoughtEvent,
  parseGrokLine,
} from "../../src/grok-parser.ts";
import { buildGrokArgs, parseGrokModelsOutput } from "../../src/grok-runner.ts";

const grokModelId = fc
  .stringMatching(/^[a-z0-9][a-z0-9._-]{0,63}$/)
  .filter((value) => !value.includes(":"));

describe("parseGrokLine properties", () => {
  it("never throws for arbitrary input", () => {
    fc.assert(
      fc.property(fc.string(), (line) => {
        assert.doesNotThrow(() => parseGrokLine(line));
      }),
    );
  });

  it("round-trips current Grok text events", () => {
    fc.assert(
      fc.property(fc.string(), (data) => {
        const parsed = parseGrokLine(JSON.stringify({ type: "text", data }));
        assert.ok(parsed);
        assert.equal(isTextEvent(parsed), true);
        if (isTextEvent(parsed)) assert.equal(parsed.data, data);
      }),
    );
  });

  it("round-trips current Grok thought events", () => {
    fc.assert(
      fc.property(fc.string(), (data) => {
        const parsed = parseGrokLine(JSON.stringify({ type: "thought", data }));
        assert.ok(parsed);
        assert.equal(isThoughtEvent(parsed), true);
        if (isThoughtEvent(parsed)) assert.equal(parsed.data, data);
      }),
    );
  });

  it("round-trips current Grok end events", () => {
    fc.assert(
      fc.property(
        fc.record({
          stopReason: fc.option(fc.constantFrom("EndTurn", "MaxTokens", "Unknown"), {
            nil: undefined,
          }),
          sessionId: fc.option(fc.uuid(), { nil: undefined }),
          requestId: fc.option(fc.uuid(), { nil: undefined }),
        }),
        (event) => {
          const parsed = parseGrokLine(JSON.stringify({ type: "end", ...event }));
          assert.ok(parsed);
          assert.equal(isEndEvent(parsed), true);
          if (isEndEvent(parsed)) {
            assert.equal(parsed.stopReason, event.stopReason);
            assert.equal(parsed.sessionId, event.sessionId);
            assert.equal(parsed.requestId, event.requestId);
          }
        },
      ),
    );
  });

  it("classifies top-level error events without requiring a specific shape", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (message, error) => {
        const parsed = parseGrokLine(JSON.stringify({ type: "error", message, error }));
        assert.ok(parsed);
        assert.equal(isErrorEvent(parsed), true);
      }),
    );
  });
});

describe("buildGrokArgs properties", () => {
  it("keeps prompt as one argument and never shell-joins it", () => {
    fc.assert(
      fc.property(fc.string(), (prompt) => {
        const args = buildGrokArgs(prompt, { modelId: "grok-build" });
        assert.equal(args[0], "-p");
        assert.equal(args[1], prompt);
        assert.equal(args.filter((arg) => arg === prompt).length, 1);
      }),
    );
  });

  it("never emits out-of-scope subagent/best-of-n orchestration flags", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 1, max: 10 }), (agentName, bestOfN) => {
        const args = buildGrokArgs("prompt", {
          agent: agentName,
          agents: JSON.stringify({ worker: { model: "grok-build" } }),
          bestOfN,
          worktree: true,
        } as any);
        assert.ok(!args.includes("--agent"));
        assert.ok(!args.includes("--agents"));
        assert.ok(!args.includes("--best-of-n"));
        assert.ok(!args.includes("--worktree"));
      }),
    );
  });
});

describe("parseGrokModelsOutput properties", () => {
  it("parses JSON-array model ids exactly once", () => {
    fc.assert(
      fc.property(fc.uniqueArray(grokModelId, { minLength: 1, maxLength: 20 }), (ids) => {
        const models = ids.map((id) => ({ id, name: `${id} name` }));
        const parsed = parseGrokModelsOutput(JSON.stringify(models));
        assert.deepEqual(
          parsed.map((model) => model.id),
          ids,
        );
      }),
    );
  });

  it("deduplicates repeated plain-text model ids", () => {
    fc.assert(
      fc.property(fc.uniqueArray(grokModelId, { minLength: 1, maxLength: 20 }), (ids) => {
        const stdout = ids.flatMap((id) => [`* ${id}`, `- ${id}`]).join("\n");
        const parsed = parseGrokModelsOutput(stdout);
        assert.deepEqual(
          parsed.map((model) => model.id),
          ids,
        );
      }),
    );
  });
});
