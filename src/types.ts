/**
 * Wire protocol types for Grok Build CLI streaming-json NDJSON communication.
 *
 * Grok CLI in --output-format streaming-json emits newline-delimited JSON objects
 * on stdout. Each object has a "type" field. Known types:
 *   - "assistant" - a streaming message event (text delta, tool call, etc.)
 *   - "result"    - final result with usage stats
 *   - "system"    - system-level messages (session info, errors)
 */

/** A single Grok streaming-json NDJSON message. */
export interface GrokStreamEvent {
  type: "assistant";
  message?: {
    id?: string;
    role?: string;
    content?: GrokContentBlock[];
    model?: string;
    usage?: GrokUsage;
    stop_reason?: string;
  };
  delta?: GrokDelta;
  index?: number;
}

export interface GrokResultEvent {
  type: "result";
  subtype?: "success" | "error";
  result?: string;
  error?: string;
  session_id?: string;
  usage?: GrokUsage;
}

export interface GrokSystemEvent {
  type: "system";
  subtype?: string;
  message?: string;
  session_id?: string;
}

export type GrokNdjsonMessage =
  | GrokStreamEvent
  | GrokResultEvent
  | GrokSystemEvent;

/** Content block in a Grok assistant message. */
export interface GrokContentBlock {
  type: "text" | "tool_use" | "thinking";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  thinking?: string;
  signature?: string;
}

/** Delta for incremental streaming updates. */
export interface GrokDelta {
  type?: "text_delta" | "input_json_delta" | "thinking_delta";
  text?: string;
  partial_json?: string;
  thinking?: string;
  stop_reason?: string;
}

/** Token usage from Grok. */
export interface GrokUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
}

/** Content block tracking during stream processing. */
export interface TrackedContentBlock {
  type: "text" | "thinking";
  text: string;
  index: number;
}

export interface TrackedToolBlock {
  type: "tool_use";
  index: number;
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  partialJson: string;
}

export type TrackedBlock = TrackedContentBlock | TrackedToolBlock;

/** Options for spawnGrok. */
export interface GrokSpawnOptions {
  cwd?: string;
  signal?: AbortSignal;
  modelId?: string;
  sessionId?: string;
  resumeSessionId?: string;
  alwaysApprove?: boolean;
}

/** Result of running a Grok command (for the grok_run tool). */
export interface GrokRunResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
}
