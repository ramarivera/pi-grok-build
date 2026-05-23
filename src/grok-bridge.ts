/**
 * Event bridge for translating Grok CLI streaming events into
 * Pi's AssistantMessageEventStream events.
 *
 * Follows the same pattern as pi-claude-cli's event-bridge.ts.
 * Maintains internal state to track content blocks and accumulate
 * the final AssistantMessage.
 */

import { calculateCost } from "@earendil-works/pi-ai";
import type {
  AssistantMessage,
  AssistantMessageEventStream,
  Model,
  TextContent,
  ThinkingContent,
  ToolCall,
} from "@earendil-works/pi-ai";
import type {
  GrokStreamEvent,
  GrokContentBlock,
  GrokDelta,
  TrackedBlock,
  TrackedContentBlock,
  TrackedToolBlock,
} from "./types.ts";

/** Event bridge interface. */
export interface GrokEventBridge {
  handleStreamEvent(event: GrokStreamEvent): void;
  getOutput(): AssistantMessage;
}

/**
 * Map Grok stop reasons to Pi's stop reason format.
 */
function mapStopReason(
  reason: string | undefined,
): "stop" | "length" | "toolUse" {
  switch (reason) {
    case "tool_use":
      return "toolUse";
    case "max_tokens":
    case "length":
      return "length";
    case "end_turn":
    case "stop":
    default:
      return "stop";
  }
}

/**
 * Create an event bridge that translates Grok streaming events
 * into Pi's AssistantMessageEventStream events.
 */
export function createGrokEventBridge(
  stream: AssistantMessageEventStream,
  model: Model<any>,
): GrokEventBridge {
  const blocks: TrackedBlock[] = [];
  const output: AssistantMessage = {
    role: "assistant" as const,
    content: [] as (TextContent | ThinkingContent | ToolCall)[],
    api: "pi-grok-build",
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop" as const,
    timestamp: Date.now(),
  };

  let started = false;

  function handleStreamEvent(event: GrokStreamEvent): void {
    // Emit start event on first message
    if (!started) {
      stream.push({ type: "start", partial: output });
      started = true;
    }

    // Handle top-level message content (full blocks, non-streaming)
    if (event.message?.content) {
      handleFullContent(event.message.content, event.message.usage, event.message.stop_reason);
      return;
    }

    // Handle delta-based streaming
    if (event.delta) {
      handleDelta(event.delta, event.index ?? 0);
    }

    // Handle message-level usage
    if (event.message?.usage) {
      applyUsage(event.message.usage);
    }

    // Handle stop reason
    if (event.message?.stop_reason) {
      output.stopReason = mapStopReason(event.message.stop_reason);
    }
  }

  function handleFullContent(
    content: GrokContentBlock[],
    usage?: import("./types.ts").GrokUsage,
    stopReason?: string,
  ): void {
    for (const block of content) {
      if (block.type === "text" && typeof block.text === "string") {
        const tracked: TrackedContentBlock = {
          type: "text",
          text: block.text,
          index: output.content.length,
        };
        blocks.push(tracked);
        output.content.push({ type: "text" as const, text: block.text });

        stream.push({
          type: "text_start",
          contentIndex: tracked.index,
          partial: output,
        });
        stream.push({
          type: "text_delta",
          contentIndex: tracked.index,
          delta: block.text,
          partial: output,
        });
        stream.push({
          type: "text_end",
          contentIndex: tracked.index,
          content: block.text,
          partial: output,
        });
      } else if (block.type === "thinking" && block.thinking) {
        const tracked: TrackedContentBlock = {
          type: "thinking",
          text: block.thinking,
          index: output.content.length,
        };
        blocks.push(tracked);
        output.content.push({
          type: "thinking" as const,
          thinking: block.thinking,
          thinkingSignature: block.signature ?? "",
        });

        stream.push({
          type: "thinking_start",
          contentIndex: tracked.index,
          partial: output,
        });
        stream.push({
          type: "thinking_delta",
          contentIndex: tracked.index,
          delta: block.thinking,
          partial: output,
        });
        stream.push({
          type: "thinking_end",
          contentIndex: tracked.index,
          content: block.thinking,
          partial: output,
        });
      } else if (block.type === "tool_use" && block.name) {
        const idx = output.content.length;
        const toolBlock: TrackedToolBlock = {
          type: "tool_use",
          index: idx,
          id: block.id ?? `tool_${idx}`,
          name: block.name,
          arguments: block.input ?? {},
          partialJson: "",
        };
        blocks.push(toolBlock);
        output.content.push({
          type: "toolCall" as const,
          id: toolBlock.id,
          name: toolBlock.name,
          arguments: toolBlock.arguments,
        } as ToolCall);

        stream.push({
          type: "toolcall_start",
          contentIndex: idx,
          partial: output,
        });
        stream.push({
          type: "toolcall_end",
          contentIndex: idx,
          toolCall: {
            type: "toolCall" as const,
            id: toolBlock.id,
            name: toolBlock.name,
            arguments: toolBlock.arguments,
          } as ToolCall,
          partial: output,
        });
      }
    }

    if (usage) applyUsage(usage);
    if (stopReason) output.stopReason = mapStopReason(stopReason);
  }

  function handleDelta(delta: GrokDelta, index: number): void {
    const deltaType = delta.type;

    if (deltaType === "text_delta" && delta.text != null) {
      const existing = blocks.findIndex(
        (b) => b.index === index && b.type === "text",
      );
      if (existing >= 0) {
        const block = blocks[existing] as TrackedContentBlock;
        block.text += delta.text;
        (output.content[existing] as TextContent).text = block.text;

        stream.push({
          type: "text_delta",
          contentIndex: existing,
          delta: delta.text,
          partial: output,
        });
      } else {
        // Create new text block for this index
        const tracked: TrackedContentBlock = {
          type: "text",
          text: delta.text,
          index: output.content.length,
        };
        blocks.push(tracked);
        output.content.push({ type: "text" as const, text: delta.text });

        stream.push({
          type: "text_start",
          contentIndex: tracked.index,
          partial: output,
        });
        stream.push({
          type: "text_delta",
          contentIndex: tracked.index,
          delta: delta.text,
          partial: output,
        });
      }
    } else if (deltaType === "thinking_delta" && delta.thinking != null) {
      const existing = blocks.findIndex(
        (b) => b.index === index && b.type === "thinking",
      );
      if (existing >= 0) {
        const block = blocks[existing] as TrackedContentBlock;
        block.text += delta.thinking;
        (output.content[existing] as ThinkingContent).thinking = block.text;

        stream.push({
          type: "thinking_delta",
          contentIndex: existing,
          delta: delta.thinking,
          partial: output,
        });
      } else {
        const tracked: TrackedContentBlock = {
          type: "thinking",
          text: delta.thinking,
          index: output.content.length,
        };
        blocks.push(tracked);
        output.content.push({
          type: "thinking" as const,
          thinking: delta.thinking,
          thinkingSignature: "",
        });

        stream.push({
          type: "thinking_start",
          contentIndex: tracked.index,
          partial: output,
        });
        stream.push({
          type: "thinking_delta",
          contentIndex: tracked.index,
          delta: delta.thinking,
          partial: output,
        });
      }
    } else if (deltaType === "input_json_delta" && delta.partial_json != null) {
      const existing = blocks.findIndex(
        (b) => b.index === index && b.type === "tool_use",
      );
      if (existing >= 0) {
        const block = blocks[existing] as TrackedToolBlock;
        block.partialJson += delta.partial_json;

        try {
          block.arguments = JSON.parse(block.partialJson);
          (output.content[existing] as ToolCall).arguments = block.arguments;
        } catch {
          // Partial JSON, keep previous
        }

        stream.push({
          type: "toolcall_delta",
          contentIndex: existing,
          delta: delta.partial_json,
          partial: output,
        });
      } else {
        // Create new tool block for this index
        const tracked: TrackedToolBlock = {
          type: "tool_use",
          index: output.content.length,
          id: `tool_${output.content.length}`,
          name: "unknown",
          arguments: {},
          partialJson: delta.partial_json,
        };
        blocks.push(tracked);
        output.content.push({
          type: "toolCall" as const,
          id: tracked.id,
          name: tracked.name,
          arguments: tracked.arguments,
        } as ToolCall);

        stream.push({
          type: "toolcall_start",
          contentIndex: tracked.index,
          partial: output,
        });
        stream.push({
          type: "toolcall_delta",
          contentIndex: tracked.index,
          delta: delta.partial_json,
          partial: output,
        });

        try {
          tracked.arguments = JSON.parse(tracked.partialJson);
          (output.content[tracked.index] as ToolCall).arguments = tracked.arguments;
        } catch {
          // Partial JSON
        }
      }
    }

    if (delta.stop_reason) {
      output.stopReason = mapStopReason(delta.stop_reason);
    }
  }

  function applyUsage(usage: import("./types.ts").GrokUsage): void {
    if (usage.input_tokens != null) output.usage.input = usage.input_tokens;
    if (usage.output_tokens != null) output.usage.output = usage.output_tokens;
    if (usage.cache_read_input_tokens != null) {
      output.usage.cacheRead = usage.cache_read_input_tokens;
    }

    output.usage.totalTokens =
      output.usage.input +
      output.usage.output +
      output.usage.cacheRead +
      output.usage.cacheWrite;
    calculateCost(model, output.usage);
  }

  return {
    handleStreamEvent,
    getOutput: () => output,
  };
}
