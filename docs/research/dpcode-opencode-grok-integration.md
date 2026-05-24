# Context research: dpcode and OpenCode Grok integrations

Bead: `pgb-003`  
Date: 2026-05-24

## Reference repos inspected

| Repo | Local cache | Commit | Notes |
|---|---|---:|---|
| `Emanuele-web04/dpcode` | `/Users/ramarivera/.context/dpcode` | `4cd0d65d` | Has the most relevant Grok Build CLI integration. |
| `sst/opencode` | `/Users/ramarivera/.context/opencode` | `0cf99cf5f` | Has xAI HTTP provider and ACP docs/patterns, but not Grok CLI provider. |

`~/.context/btca.config.jsonc` was updated with both repos and still uses `provider: opencode` + `model: gpt-5.3-codex-spark`.

## Short version

DP Code is the useful prior art. It integrates Grok through ACP, not JSONL: `grok agent --no-leader [--always-approve] [-m model] [--reasoning-effort effort] stdio`. It treats auth as an ACP initialization concern, preferring an explicit xAI API key when available and falling back to Grok's cached CLI token. It also discovered an important Grok ACP limitation: model/effort changes are startup-only because Grok ACP 0.1.210 advertises model state but does not support `session/set_config_option`.

OpenCode is useful for two narrower things: (1) its ACP documentation confirms the editor-agent subprocess shape over stdio/JSON-RPC, and (2) its xAI provider shows the HTTP path should use xAI's OpenAI-compatible endpoints with `XAI_API_KEY`, including reasoning/usage parsing when using HTTP APIs. It does not appear to implement local Grok CLI JSONL or ACP as a provider.

## DP Code findings

### 1. Grok ACP process shape

DP Code builds Grok ACP startup args in `apps/server/src/provider/acp/GrokAcpSupport.ts`:

- default command: `grok`
- default args: `agent --no-leader stdio`
- `--always-approve` is inserted after `agent`, before `stdio`
- `-m <model>` and `--reasoning-effort <effort>` are startup args
- optional custom binary path exists in DP Code, but **pi-grok-build must not copy that default**, because our goal requires PATH-only `grok`

Evidence:

- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:20` defines `binaryPath`, `model`, `reasoningEffort`, and `alwaysApprove` settings.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:55` starts args with `agent --no-leader`.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:63` notes `--always-approve` belongs before `stdio`.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:67` adds `-m <model>`.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:71` adds `--reasoning-effort <effort>`.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:78` defaults command to `grok`.

The test fixture confirms exact arg order:

- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.test.ts:17` expects default `{ command: "grok", args: ["agent", "--no-leader", "stdio"] }`.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.test.ts:34` expects `agent --no-leader --always-approve -m grok-build --reasoning-effort high stdio`.

### 2. Grok ACP auth behavior

DP Code resolves ACP auth from the methods advertised by Grok at initialization:

- prefer `xai.api_key` if `XAI_API_KEY` or `GROK_CODE_XAI_API_KEY` exists
- otherwise use `cached_token` when present
- otherwise fail with a clear instruction to run `grok` locally or set an API key

Evidence:

- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:34` declares `xai.api_key` and `cached_token` auth method IDs.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:36` recognizes `XAI_API_KEY` and legacy `GROK_CODE_XAI_API_KEY`.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:83` prefers API key auth.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:86` falls back to cached token.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:91` errors with `Run \`grok\` to authenticate locally, or set XAI_API_KEY.`
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.test.ts:58` through `:106` tests API key preference, legacy env key, cached token fallback, and unsupported auth failure.

Implication for pi-grok-build:

- JSONL mode should not inspect `~/.grok` internals; just call `grok` and surface CLI auth errors.
- ACP mode can use the official ACP auth negotiation if/when implemented.
- Direct xAI media tools can use `XAI_API_KEY` first; token spelunking in `~/.grok` is later research and must be isolated from provider auth.

### 3. Grok ACP model and reasoning limitations

DP Code encodes Grok Build capabilities and aliases:

- reasoning effort levels: `none`, `low`, `medium`, `high`
- no fast mode
- no thinking toggle
- built-in model slugs: `grok-build-0.1`, `grok-build`
- aliases like `grok-4.3`, `grok-latest`, and `grok-code-fast-1` normalize to supported build slugs

Evidence:

- `/Users/ramarivera/.context/dpcode/packages/contracts/src/model.ts:199` defines `GROK_BUILD_CAPABILITIES` with `none|low|medium|high`.
- `/Users/ramarivera/.context/dpcode/packages/contracts/src/model.ts:207` marks `supportsFastMode: false` and `supportsThinkingToggle: false`.
- `/Users/ramarivera/.context/dpcode/packages/contracts/src/model.ts:430` registers `grok-build-0.1` and `grok-build`.
- `/Users/ramarivera/.context/dpcode/packages/contracts/src/model.ts:601` maps aliases to canonical Grok slugs.

Most important ACP limitation:

- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.ts:146` says Grok ACP 0.1.210 advertises models but does **not** implement `session/set_config_option`.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/acp/GrokAcpSupport.test.ts:121` verifies `applyGrokAcpModelSelection` does not call config option methods.

Implication for pi-grok-build:

- For JSONL mode, model/effort are one-shot command args.
- For ACP mode, model/effort should also be process-start settings; changing them likely requires a new ACP process/session.
- Do not claim live in-session model switching in ACP unless verified against the current local Grok CLI.

### 4. Health/error behavior

DP Code probes `grok --version` with a timeout and distinguishes missing binary, timeout, non-zero CLI result, and auth uncertainty.

Evidence:

- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/ProviderHealth.ts:1281` defaults executable to `grok`.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/ProviderHealth.ts:1287` runs `--version` under timeout.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/ProviderHealth.ts:1298` returns `Grok CLI (\`grok\`) is not installed or not on PATH.` for command-missing cases.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/ProviderHealth.ts:1312` surfaces non-zero CLI failures with detail.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/ProviderHealth.ts:1332` reports API-key auth when present.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/ProviderHealth.ts:1345` otherwise tells the user to run `grok` or set `XAI_API_KEY`.

Implication for pi-grok-build:

- Implement `grok_inspect` around `grok --version`, `grok models`, and a lightweight auth/status probe.
- Missing `grok` should become a Pi-visible error event/tool error, not a quiet console log.
- Use timeouts around probes; do not let startup freeze the Pi UI.

### 5. ACP runtime reliability lessons

DP Code's Grok adapter adds several protections around ACP runtime behavior:

- debug logging is gated by env vars (`DPCODE_GROK_ACP_DEBUG`, legacy `DP_GROK_ACP_DEBUG`)
- `session/prompt` payloads are redacted in logs
- protocol logs are bounded/truncated
- resume replay events are suppressed until the stream goes quiet
- permission requests are routed through a normal approval flow, with full-access auto-approval when Grok exposes an allow option

Evidence:

- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/GrokAdapter.ts:68` defines Grok ACP debug env names.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/GrokAdapter.ts:115` redacts `session/prompt` payloads.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/GrokAdapter.ts:87` truncates log payloads.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/GrokAdapter.ts:829` waits for resume replay quiet to avoid stale chunks leaking into the next turn.
- `/Users/ramarivera/.context/dpcode/apps/server/src/provider/Layers/GrokAdapter.ts:901` passes model, reasoning, and full-access approval into Grok startup settings.

Implication for pi-grok-build:

- ACP mode should be a later bead, not mixed into the JSONL MVP.
- Debug/trace logging needs payload limits and prompt redaction.
- If ACP resume is supported, stale replay suppression must be tested.

## OpenCode findings

### 1. OpenCode xAI provider is HTTP API based, not local Grok CLI

OpenCode's xAI provider uses OpenAI Responses and OpenAI-compatible Chat routes with `XAI_API_KEY` bearer auth and base URL `https://api.x.ai/v1`.

Evidence:

- `/Users/ramarivera/.context/opencode/packages/llm/src/providers/xai.ts:8` defines provider id `xai`.
- `/Users/ramarivera/.context/opencode/packages/llm/src/providers/xai.ts:16` resolves bearer auth from `XAI_API_KEY`.
- `/Users/ramarivera/.context/opencode/packages/llm/src/providers/xai.ts:24` configures OpenAI Responses route.
- `/Users/ramarivera/.context/opencode/packages/llm/src/providers/xai.ts:34` configures OpenAI-compatible Chat route.
- `/Users/ramarivera/.context/opencode/packages/llm/src/providers/openai-compatible-profile.ts:15` sets xAI base URL to `https://api.x.ai/v1`.

Implication for pi-grok-build:

- Direct image/video tools should probably use xAI API + `XAI_API_KEY`, not pretend the Grok CLI exposes media generation flags.
- Reusing Grok CLI cached browser token for xAI API calls is unproven and should be a separate security/auth research bead before implementation.

### 2. OpenCode streaming parser patterns are useful for reasoning/usage

OpenCode maps OpenAI-compatible `reasoning_content` and usage chunks into canonical events.

Evidence:

- `/Users/ramarivera/.context/opencode/packages/llm/src/protocols/openai-chat.ts:250` validates `reasoning_effort`.
- `/Users/ramarivera/.context/opencode/packages/llm/src/protocols/openai-chat.ts:269` requests `stream_options.include_usage`.
- `/Users/ramarivera/.context/opencode/packages/llm/src/protocols/openai-chat.ts:300` maps usage including cached and reasoning token subsets.
- `/Users/ramarivera/.context/opencode/packages/llm/src/protocols/openai-chat.ts:328` maps `reasoning_content` into reasoning deltas.
- `/Users/ramarivera/.context/opencode/packages/llm/src/protocols/openai-chat.ts:330` maps content into text deltas.
- `/Users/ramarivera/.context/opencode/packages/llm/src/protocols/openai-chat.ts:372` finalizes finish events with usage.

Implication for pi-grok-build:

- Our JSONL parser should model `thought` separately from visible `text`, similar to reasoning/content split.
- If Grok JSONL does not include usage, emit zero/unknown usage honestly instead of fabricating.
- If ACP/API mode later gives usage, map it into Pi's usage/cost primitives.

### 3. OpenCode ACP docs confirm the subprocess/protocol shape

OpenCode documents ACP as a subprocess run over stdio using JSON-RPC. The command shape is `opencode acp`.

Evidence:

- `/Users/ramarivera/.context/opencode/packages/web/src/content/docs/acp.mdx:16` says configure the editor to run `opencode acp`.
- `/Users/ramarivera/.context/opencode/packages/web/src/content/docs/acp.mdx:18` says the subprocess communicates over JSON-RPC via stdio.
- `/Users/ramarivera/.context/opencode/packages/web/src/content/docs/acp.mdx:145` states ACP generally supports the same terminal features, with slash-command caveats.

Implication for pi-grok-build:

- ACP integration mode should be documented as a long-lived subprocess/protocol bridge, not as a simple prompt subprocess.
- JSONL mode is simpler and safer for MVP; ACP has richer session/tool behavior but more lifecycle/debugging risk.

## Recommendations for pi-grok-build

### Immediate `pgb-004` JSONL MVP

1. Remove the WIP private binary fallback. `detectGrokBinary()` must only validate `grok` on PATH.
2. Use Node `spawn("grok", args, { shell: false })`; never build shell strings.
3. Build args from an allowlisted config only:
   - `-p <prompt>`
   - `--model grok-build` or other discovered model
   - `--output-format streaming-json`
   - `--always-approve`
   - `--no-plan`
   - `--no-subagents`
   - `--max-turns 1`
   - optional `--cwd`
   - optional `--reasoning-effort none|low|medium|high` only if local CLI help confirms it for `grok -p`
4. Parse current JSONL events:
   - `thought` -> Pi reasoning/thinking event
   - `text` -> Pi text event
   - `end` -> final done event
   - process non-zero/stderr/auth/model errors -> Pi-visible error event
5. Register only honest model IDs from `grok models`; `grok-build` must be present.
6. Add `grok_inspect` and `grok_models` tools before media tools.
7. Do not advertise subagents or best-of-n.

### Later ACP mode

1. Use `grok agent --no-leader [--always-approve] [-m model] [--reasoning-effort effort] stdio`.
2. Resolve auth via ACP advertised methods if Pi extension code owns the ACP client.
3. Treat model and reasoning as startup settings; restart process/session when changed.
4. Add debug logging with redaction, bounded payloads, and env gating.
5. Add explicit tests for unsupported `session/set_config_option` behavior before claiming dynamic ACP model config.

### Later media tools

1. First check whether current `grok` CLI exposes media/image/video generation commands. If not, do not route through CLI.
2. Prefer `XAI_API_KEY` and documented xAI API endpoints for image/video tools.
3. Treat `~/.grok` token reuse as untrusted/unknown until separately researched and proven safe.
4. Keep media tools separate from provider acceptance; provider should not depend on media auth.

## What not to copy

- DP Code's configurable `binaryPath` defaulting is useful for an app, but conflicts with this extension's PATH-only requirement.
- DP Code's large ACP adapter should not be copied into the JSONL MVP. It is a later integration mode.
- OpenCode's xAI HTTP provider should not be mistaken for local Grok Build CLI integration.
- Static aliases like `grok-4.3 -> grok-build` are risky in pi-grok-build because our local CLI already rejected `grok-4.3`; prefer dynamic `grok models` discovery plus a small documented alias layer only after tests.

## Acceptance checklist for pgb-003

- [x] Cloned/refreshed `dpcode` under `~/.context`.
- [x] Refreshed `opencode` under `~/.context`.
- [x] Recorded commit hashes.
- [x] Updated `~/.context/btca.config.jsonc` for both repos.
- [x] Inspected DP Code Grok ACP process/auth/model/health/test files.
- [x] Inspected OpenCode xAI provider and ACP docs.
- [x] Produced concrete recommendations for JSONL MVP, ACP mode, and media tools.
