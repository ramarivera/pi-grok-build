# Pi platform contract for pi-grok-build

Bead: `pgb-002` — Define real Pi extension/provider contract across supported modes  
Date: 2026-05-24  
Evidence sources: installed `@earendil-works/pi-coding-agent@0.75.4` / local `node_modules` `.d.ts`, plus `pi --help`.

## What Pi modes actually exist

The local Pi CLI exposes three output modes, not four separate MCP/RCP/ACP modes:

| Pi surface | Evidence | Meaning for provider |
|---|---|---|
| Interactive | `pi` / `pi "prompt"` from `pi --help` examples | Uses the same model/provider registry and extension runtime, with full TUI `ExtensionUIContext`. Provider must stream Pi assistant events correctly. |
| Print text | `pi -p "prompt"`, `--print`, `PrintModeOptions.mode: "text"` | Non-interactive single-shot. This is the primary acceptance path for visible final text. |
| Print JSON | `pi --mode json "prompt"`, `PrintModeOptions.mode: "json"` | Emits Pi event stream as JSON. E2E tests must assert provider events/output here. |
| RPC | `--mode rpc`, `Mode = "text" | "json" | "rpc"`, `runRpcMode` | JSONL stdin/stdout protocol for embedding Pi. Provider should work because it is selected through the same model registry. |

No separate Pi MCP mode or Pi ACP mode was found in the CLI mode type. ACP is relevant to **Grok CLI integration mode** (`grok agent stdio`), not a Pi run mode.

## Extension API surfaces relevant to this provider

| Surface | Evidence | Required pi-grok-build behavior |
|---|---|---|
| Provider registration | `ExtensionAPI.registerProvider(name, config: ProviderConfig)` | Register `pi-grok-build` with honest Grok CLI models only. Use `streamSimple` for custom provider streaming. |
| Model registration | `ProviderConfig.models?: ProviderModelConfig[]` | Populate from `grok models`, not xAI API catalog guesses. Include `reasoning`, `thinkingLevelMap`, `input`, `cost`, `contextWindow`, `maxTokens`. Claim only proven text input for the provider until real Grok CLI image input is implemented. |
| Custom streaming | `ProviderConfig.streamSimple?: (model, context, options) => AssistantMessageEventStream` | Core provider must return a valid `AssistantMessageEventStream` for all Pi modes. |
| Thinking support | `ProviderModelConfig.reasoning`, `thinkingLevelMap`, Pi `--thinking` / `setThinkingLevel` | Advertise reasoning only if Grok `thought` events are mapped to Pi thinking content/events. |
| Cost tracking | Pi AI `AssistantMessage.usage` and `calculateCost(model, usage)` pattern | If Grok JSONL gives no usage, set usage to zero honestly. If ACP/JSON returns usage later, map into `input/output/cacheRead/cacheWrite` and run cost calculation. |
| Tools | `ExtensionAPI.registerTool`, `ToolDefinition.execute(toolCallId, params, signal, onUpdate, ctx)` | Expose only grounded tools. `grok_inspect` and `grok_models` are first-class. xAI Imagine media tools are registered only when `XAI_API_KEY`/`GROK_CODE_XAI_API_KEY` exists. |
| Commands | `ExtensionAPI.registerCommand(name, handler)` | `/grok status/models/inspect` can be useful diagnostic commands. Commands should use `ctx.ui.notify`; in non-UI modes `hasUI` may be false, so tools are better for programmatic paths. |
| CLI flags | `ExtensionAPI.registerFlag`, `getFlag` | Use for extension-level switches if desired, but environment/config file is likely better for JSONL vs ACP provider mode. |
| Lifecycle events | `session_start`, `session_shutdown`, `agent_start/end`, `turn_start/end`, `message_*`, `before_provider_request`, `after_provider_response` | Use for diagnostics/cleanup if needed. No need to hook everything unless implementing persistent ACP process lifecycle. |
| Error surfacing | Assistant stream can push `error` event; tools return `AgentToolResult`; UI commands use `ctx.ui.notify(..., "error")` | Missing `grok`, invalid model, auth failure, subprocess exit, parse failure, timeout, and ACP failure must become Pi-visible errors, not silent registration failures. |
| Logging | No explicit `pi.log`/logger primitive found in `ExtensionAPI` | Use pino or small internal logger gated by env/config if no richer primitive is discovered in source. Do not use log text as test oracle. |
| Shell execution | `ExtensionAPI.exec(command, args, options)` exists | For extension tools/commands, prefer safe arg arrays. Provider subprocess should use Node `spawn("grok", args)` PATH-only. Avoid shell string joins. |
| Runtime UI availability | `ExtensionContext.hasUI`, `ExtensionUIContext` | Interactive commands can use UI; provider and tools must work without UI in print/RPC modes. |

## Provider event contract implications

The provider must stream Pi assistant events, not Grok events directly.

Minimum JSONL provider behavior:

1. Create an `AssistantMessageEventStream`.
2. On first real output, push `start` with partial assistant message.
3. For Grok `thought` deltas, push Pi thinking start/delta/end according to Pi AI content type.
4. For Grok `text` deltas, push Pi text start/delta/end.
5. On Grok `end`, push `done` with final assistant message and honest stop reason.
6. On process/error/stderr failure, push `error` with an assistant-shaped error payload.
7. Always end the stream exactly once.

The current provider needs verification against `@earendil-works/pi-ai` event-stream behavior before implementation is considered done.

## Pi mode acceptance matrix

| Acceptance path | Required test | Notes |
|---|---|---|
| Text print | `pi --model pi-grok-build/grok-build -p "Respond exactly PI_GROK_OK"` | Must visibly print `PI_GROK_OK`. This is the first non-negotiable acceptance test. |
| JSON print | `pi --mode json --model pi-grok-build/grok-build -p ...` | Must emit JSON events containing text delta/final message with `PI_GROK_OK`; tests should parse JSONL rather than grep random logs. |
| RPC | Spawn Pi RPC mode or use `RpcClient`, set model to `pi-grok-build/grok-build`, prompt, wait idle, assert messages/events. | Provider should work through model registry; no separate provider code path should be needed. |
| Interactive | Manual smoke or TUI integration test if feasible. | Same provider, but command/UI behavior should also be checked. |

## Grok integration mode configuration

The extension should expose an integration mode switch for provider internals:

| Mode | Backing command | Strength | Limitation |
|---|---|---|---|
| `jsonl` | `grok -p ... --output-format streaming-json` | Simple, easy to test, no persistent process. | One-shot; less efficient; session/persistence is CLI flag based. |
| `acp` | `grok agent --no-leader --always-approve --model <model> stdio` | JSON-RPC/ACP bridge with auth/session negotiation and token metadata. | Current implementation starts a fresh ACP process/session per provider call; persistence and replay hardening are future work. |

Selection should be via env var or small config file, for example:

- `PI_GROK_BUILD_MODE=jsonl|acp`
- optional local config later if needed

`jsonl` remains the default. `acp` is implemented as a selectable per-call bridge via `grok agent stdio`; it is intentionally not persistent yet.

## Scope boundaries from the goal

- Grok subagents are out of provider scope.
- `best-of-n` is out of provider scope.
- If someone wants subagents, that should be a different extension/tooling layer.
- The provider assumes `grok` is on PATH. No private binary search. Fast fail if unavailable.
- Image/video tools are required eventually, but only after real CLI/API/auth behavior is proven.

## Current extension mismatch against this contract

| Current behavior | Contract violation |
|---|---|
| Image/video tools are API-key gated and use documented xAI Imagine endpoints; TTS/STT tools are removed | Live media generation still requires an xAI API key smoke before final release. |
| ACP mode is implemented only as a fresh process/session per provider call | Persistent ACP sessions, replay suppression, and richer tool/permission behavior remain future work. |
| Biome/Effect conventions are not wired yet | Formatting/linting and Effect TS conventions are tracked by `pgb-007`. |

## Implementation guidance for future beads

1. Rebuild JSONL provider small and boring.
2. Make model discovery a safe, explicit `grok models` parse.
3. Register only provider + `grok_inspect` + `grok_models` initially.
4. Add command diagnostics after provider works.
5. Use Pi events/tool result contracts, not log strings, as test oracle.
6. Keep JSONL as default until ACP has enough real-world soak time to justify persistence work.

## Acceptance for pgb-002

This document satisfies `pgb-002` because it maps:

- Pi run modes to extension/provider obligations.
- Provider/model/tool/command/error/logging surfaces to concrete Pi APIs.
- Goal-specific constraints to implementation boundaries.
- Current extension mismatches to follow-up implementation beads.
