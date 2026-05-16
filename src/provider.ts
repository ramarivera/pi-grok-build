/**
 * Provider orchestration for bridging Pi requests to the Grok Build CLI.
 *
 * streamViaGrok is the core function that:
 * 1. Formats conversation context as a text prompt
 * 2. Spawns `grok -p "prompt" --output-format streaming-json`
 * 3. Reads stdout line-by-line, parsing NDJSON
 * 4. Routes events through the event bridge to Pi's stream
 * 5. Handles result/error and cleans up the subprocess
 * 6. Hardened: inactivity timeout, abort handling, process registry
 */

import { createInterface } from "node:readline";
import type { AssistantMessageEventStream } from "@earendil-works/pi-ai";
import {
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
// AssistantMessageEventStream is exported as a type-only export from pi-ai.
// At runtime the class exists; use createRequire to access the constructor.
import { createRequire } from "node:module";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _AssistantMessageEventStreamCtor: any = createRequire(import.meta.url)("@earendil-works/pi-ai").AssistantMessageEventStream;
import {
  spawnGrok,
  registerProcess,
  forceKillProcess,
  captureStderr,
} from "./grok-runner.ts";
import { parseGrokLine, isStreamEvent, isResultEvent } from "./grok-parser.ts";
import { createGrokEventBridge } from "./grok-bridge.ts";
import type { GrokNdjsonMessage } from "./types.ts";

/** Inactivity timeout: kill subprocess if no stdout for 180 seconds. */
const INACTIVITY_TIMEOUT_MS = 180_000;

/** Extended stream options with optional session info. */
type StreamViaGrokOptions = SimpleStreamOptions & {
  cwd?: string;
  sessionId?: string;
};

/**
 * Build a flat text prompt from Pi conversation context.
 * Labels messages with USER: / ASSISTANT: / TOOL RESULT: roles.
 */
export function buildGrokPrompt(context: {
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
      const name = msg.toolName ?? "unknown";
      parts.push(`TOOL RESULT (${name}):`);
      parts.push(contentToText(msg.content));
    }
  }

  return parts.join("\n") || "";
}

/** Extract text from arbitrary content types. */
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

/**
 * Stream a response from Grok CLI as an AssistantMessageEventStream.
 *
 * Orchestrates the full subprocess lifecycle: spawn, parse NDJSON,
 * bridge events, handle result, and clean up.
 */
export function streamViaGrok(
  model: Model<any>,
  context: { messages: Array<{ role: string; content: unknown }>; systemPrompt?: string },
  options?: StreamViaGrokOptions,
): AssistantMessageEventStream {
  const stream = new _AssistantMessageEventStreamCtor() as AssistantMessageEventStream;

  (async () => {
    let proc: ReturnType<typeof spawnGrok> | undefined;
    let abortHandler: (() => void) | undefined;

    try {
      // Build prompt from conversation context
      const systemPrompt = context.systemPrompt
        ? `<system>\n${context.systemPrompt}\n</system>\n\n`
        : "";
      const conversation = buildGrokPrompt(context);
      const fullPrompt = systemPrompt + conversation;

      // Spawn grok subprocess
      proc = spawnGrok(fullPrompt, {
        ...(options?.cwd !== undefined ? { cwd: options.cwd } : {}),
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
        modelId: model.id,
        ...(options?.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
        alwaysApprove: true,
      });
      registerProcess(proc);

      const getStderr = captureStderr(proc);

      // Create event bridge
      const bridge = createGrokEventBridge(stream, model);

      let streamEnded = false;
      let broken = false;

      function endStreamWithError(errMsg: string): void {
        if (streamEnded || broken) return;
        streamEnded = true;
        const output = bridge.getOutput();
        const errorMessage = {
          ...output,
          content: output.content?.length
            ? output.content
            : [{ type: "text" as const, text: `Error: ${errMsg}` }],
          stopReason: "stop" as const,
        };
        stream.push({
          type: "done",
          reason: "stop",
          message: errorMessage,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        stream.end();
      }

      // Inactivity timeout
      let inactivityTimer: ReturnType<typeof setTimeout> | undefined;

      function resetInactivityTimer(): void {
        if (inactivityTimer !== undefined) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          if (proc) forceKillProcess(proc);
          endStreamWithError(
            `Grok CLI subprocess timed out: no output for ${INACTIVITY_TIMEOUT_MS / 1000} seconds`,
          );
        }, INACTIVITY_TIMEOUT_MS);
      }

      // Abort signal handling
      if (options?.signal) {
        abortHandler = () => {
          if (proc) forceKillProcess(proc);
        };
        if (options.signal.aborted) {
          abortHandler();
          return;
        }
        options.signal.addEventListener("abort", abortHandler, { once: true });
      }

      resetInactivityTimer();

      // Read NDJSON lines from stdout
      const rl = createInterface({
        input: proc.stdout!,
        crlfDelay: Infinity,
        terminal: false,
      });

      proc.on("error", (err: Error) => {
        if (broken) return;
        endStreamWithError(getStderr() || err.message);
      });

      proc.on("close", (code: number | null) => {
        clearTimeout(inactivityTimer);
        if (broken) return;
        if (code !== 0 && code !== null) {
          const stderr = getStderr();
          const message = stderr
            ? `Grok CLI exited with code ${code}: ${stderr.trim()}`
            : `Grok CLI exited unexpectedly with code ${code}`;
          endStreamWithError(message);
        }
      });

      rl.on("line", (line: string) => {
        if (broken) return;
        resetInactivityTimer();

        const msg = parseGrokLine(line);
        if (!msg) return;

        if (isStreamEvent(msg)) {
          bridge.handleStreamEvent(msg);
        } else if (isResultEvent(msg)) {
          if (msg.subtype === "error") {
            endStreamWithError(msg.error ?? "Unknown error from Grok CLI");
          }
          clearTimeout(inactivityTimer);
          if (proc) forceKillProcess(proc);
          rl.close();
        }
        // System events are silently ignored
      });

      // Wait for readline to close
      await new Promise<void>((resolve) => {
        rl.on("close", resolve);
      });

      // Push final done event
      if (!streamEnded) {
        const output = bridge.getOutput();
        const piToolCalls = (output.content || []).filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => c.type === "toolCall",
        );
        const effectiveReason =
          output.stopReason === "toolUse" && piToolCalls.length === 0
            ? "stop"
            : output.stopReason;

        streamEnded = true;
        stream.push({
          type: "done",
          reason:
            effectiveReason === "toolUse"
              ? "toolUse"
              : effectiveReason === "length"
                ? "length"
                : "stop",
          message: { ...output, stopReason: effectiveReason },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        stream.end();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      stream.push({
        type: "error",
        reason: "error",
        error: message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      stream.end();
    } finally {
      if (options?.signal && abortHandler) {
        options.signal.removeEventListener("abort", abortHandler);
      }
    }
  })();

  return stream;
}
