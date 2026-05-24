# Grok integration modes

Bead: `pgb-005` — selectable JSONL/ACP integration mode.

`pi-grok-build` can call the local `grok` CLI in two provider integration modes. Both modes still assume `grok` is on `PATH`; the extension does not search private install locations.

## Selection

Default mode is `jsonl`.

```bash
PI_GROK_BUILD_MODE=jsonl
PI_GROK_BUILD_MODE=acp
```

`PI_GROK_BUILD_INTEGRATION_MODE` is accepted as a compatibility alias, but `PI_GROK_BUILD_MODE` wins when both are set.

Invalid values surface as a Pi assistant stream `error` event instead of silently falling back.

## `jsonl` mode

Backing command:

```bash
grok -p '<prompt>' --model grok-build --output-format streaming-json --always-approve --no-plan --no-subagents --max-turns 1
```

Use this when you want the most boring, easiest-to-debug path.

Strengths:

- Simple one-shot subprocess per Pi request.
- Uses the current proven Grok streaming JSON events: `thought`, `text`, `end`, and top-level errors.
- Best covered by deterministic unit/property tests plus real Pi `-p` and `--mode json` e2e tests.
- Failure handling is straightforward: missing CLI, invalid model, auth failure, timeout, bad JSON, or non-zero exit become Pi-visible errors.

Limitations:

- No long-lived ACP session.
- Session persistence is only whatever `grok -p` exposes through CLI flags such as resume/session/continue.
- JSONL currently does not provide usage details, so provider usage is reported honestly as zero/unknown.
- The provider intentionally disables Grok subagents and plan mode for one-shot Pi calls; subagents are out of scope for this extension.

## `acp` mode

Backing command:

```bash
grok agent --no-leader --always-approve --model grok-build stdio
```

The ACP path speaks JSON-RPC over stdio:

1. `initialize`
2. `authenticate` using Grok's advertised `cached_token` when available
3. `session/new`
4. `session/prompt`
5. stream `session/update` chunks into Pi thinking/text events

Use this when you specifically want the ACP protocol bridge or want to compare it against JSONL behavior.

Strengths:

- Uses Grok's official ACP stdio surface.
- Auth is negotiated through ACP instead of guessing Grok internals.
- ACP prompt results include token metadata, so usage can be mapped into Pi's usage shape when returned.
- Matches prior-art findings from DP Code and the OpenCode ACP docs.

Limitations:

- Current implementation starts a fresh ACP process/session per Pi provider call. It is not yet a shared persistent agent process.
- Model and reasoning effort are startup arguments. Grok ACP currently does not support reliable in-session `session/set_config_option`; changing model/effort means starting a new process/session.
- ACP emits many Grok-specific notifications; the provider maps only `agent_message_chunk` and `agent_thought_chunk` into Pi events and ignores unrelated operational notifications.
- ACP can be slower than JSONL for single-shot prompts because it must initialize, authenticate, and create a session before prompting.
- Permission and tool behavior are intentionally constrained with `--always-approve`; Grok subagents remain out of provider scope.

## Current recommendation

Keep `jsonl` as the default. Use `acp` only for targeted local experiments or when you need ACP behavior specifically. If ACP proves valuable in real Pi usage, a later bead should make it persistent and add resume/replay hardening.
