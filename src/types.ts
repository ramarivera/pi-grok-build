/**
 * Wire protocol types for Grok Build CLI streaming-json NDJSON communication.
 *
 * Grok CLI in --output-format streaming-json emits newline-delimited JSON objects
 * on stdout. Each object has a "type" field. Known types:
 *   - "assistant" - a streaming message event (text delta, tool call, etc.)
 *   - "result"    - final result with usage stats
 *   - "system"    - system-level messages (session info, errors)
 *   - "error"     - top-level CLI errors, such as invalid model IDs
 *   - "text"      - current Grok Build text delta event
 *   - "thought"   - current Grok Build thought delta event
 *   - "end"       - current Grok Build final event
 */

/** Effort level for Grok headless mode. */
export type GrokEffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

/** Permission mode for Grok CLI. */
export type GrokPermissionMode =
  | "default"
  | "acceptEdits"
  | "auto"
  | "dontAsk"
  | "bypassPermissions"
  | "plan";

/** Reasoning effort for reasoning models (0.1.216 surface). */
export type GrokReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

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

export interface GrokErrorEvent {
  type: "error";
  message?: string;
  error?: string;
}

export interface GrokTextEvent {
  type: "text";
  data?: string;
}

export interface GrokThoughtEvent {
  type: "thought";
  data?: string;
}

export interface GrokEndEvent {
  type: "end";
  stopReason?: string;
  sessionId?: string;
  requestId?: string;
}

export type GrokNdjsonMessage =
  | GrokStreamEvent
  | GrokResultEvent
  | GrokSystemEvent
  | GrokErrorEvent
  | GrokTextEvent
  | GrokThoughtEvent
  | GrokEndEvent;

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

  // -- Headless capabilities (current as of grok 0.1.216 per live --help + GROK_INSIGHTS §17) --

  /** Continue the most recent session for the current working directory. */
  continueSession?: boolean;

  /** Set the working directory via --cwd flag (distinct from spawn cwd). */
  workingDirectory?: string;

  /** Effort level [low, medium, high, xhigh, max]. */
  effort?: GrokEffortLevel;

  /** Maximum number of agent turns. */
  maxTurns?: number;

  /** Reasoning effort for reasoning models. */
  reasoningEffort?: GrokReasoningEffort;

  /** Append a self-verification loop to the prompt. */
  check?: boolean;

  /** Send the prompt exactly as given (no template wrapping). */
  verbatim?: boolean;

  /** Disable web search and web fetch tools. */
  disableWebSearch?: boolean;

  /** Disable subagent spawning. */
  noSubagents?: boolean;

  /** Disable plan mode. */
  noPlan?: boolean;

  /** Disable cross-session memory for this session. */
  noMemory?: boolean;

  /** Enable experimental cross-session memory. */
  experimentalMemory?: boolean;

  /** Permission mode for the session. */
  permissionMode?: GrokPermissionMode;

  /** Extra rules to append to the system prompt. */
  rules?: string;

  /** Override the agent's system prompt entirely. */
  systemPromptOverride?: string;

  /** Built-in tools to allow (comma-separated). */
  tools?: string;

  /** Built-in tools to remove (comma-separated). */
  disallowedTools?: string;

  /** Permission allow rules (repeatable). */
  allowRules?: string[];

  /** Permission deny rules (repeatable). */
  denyRules?: string[];

  /** Sandbox profile for filesystem and network access. */
  sandbox?: string;

  // -- 0.1.216 additions (from GROK_INSIGHTS §17 + live `grok --help`) --

  /** Restore the original session's git commit when resuming (pairs with --resume / --continue). */
  restoreCode?: boolean;

  /** Force OAuth login flow (--oauth). */
  oauth?: boolean;

  /** Single-turn prompt from a file instead of inline (--prompt-file). */
  promptFile?: string;

  /** Single-turn prompt as JSON content blocks (--prompt-json). */
  promptJson?: string;
}

/** Result of running a Grok command (for the grok_run tool). */
export interface GrokRunResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

/** Model descriptor returned by grok inspect / grok models. */
export interface GrokModelDescriptor {
  id: string;
  name: string;
}

/** Session descriptor returned by grok sessions. */
export interface GrokSessionDescriptor {
  id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
}
