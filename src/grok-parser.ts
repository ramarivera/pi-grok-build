/**
 * Stream parser for Grok CLI streaming-json NDJSON output.
 *
 * Parses newline-delimited JSON lines from `grok -p --output-format streaming-json`
 * into typed GrokNdjsonMessage objects. Resilient to debug noise, empty lines,
 * and malformed JSON.
 */

import type { GrokNdjsonMessage } from "./types.ts";

/**
 * Parse a single line from Grok CLI stdout into a typed message.
 * Never throws — returns null for non-JSON lines, empty lines, or parse errors.
 */
export function parseGrokLine(line: string): GrokNdjsonMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Grok may emit non-JSON debug output lines
  if (!trimmed.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return parsed as GrokNdjsonMessage;
}

/**
 * Check if a parsed message is a stream event (assistant content).
 */
export function isStreamEvent(
  msg: GrokNdjsonMessage,
): msg is import("./types.ts").GrokStreamEvent {
  return msg.type === "assistant";
}

/**
 * Check if a parsed message is the final result.
 */
export function isResultEvent(
  msg: GrokNdjsonMessage,
): msg is import("./types.ts").GrokResultEvent {
  return msg.type === "result";
}

/**
 * Check if a parsed message is a top-level Grok CLI error event.
 */
export function isErrorEvent(
  msg: GrokNdjsonMessage,
): msg is import("./types.ts").GrokErrorEvent {
  return msg.type === "error";
}

/**
 * Check if a parsed message is a current Grok CLI text delta event.
 */
export function isTextEvent(
  msg: GrokNdjsonMessage,
): msg is import("./types.ts").GrokTextEvent {
  return msg.type === "text";
}

/**
 * Check if a parsed message is a current Grok CLI thought delta event.
 */
export function isThoughtEvent(
  msg: GrokNdjsonMessage,
): msg is import("./types.ts").GrokThoughtEvent {
  return msg.type === "thought";
}

/**
 * Check if a parsed message is a current Grok CLI final event.
 */
export function isEndEvent(
  msg: GrokNdjsonMessage,
): msg is import("./types.ts").GrokEndEvent {
  return msg.type === "end";
}

/**
 * Check if a parsed message is a system event.
 */
export function isSystemEvent(
  msg: GrokNdjsonMessage,
): msg is import("./types.ts").GrokSystemEvent {
  return msg.type === "system";
}
