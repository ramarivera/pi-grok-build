# CURRENT_STATE — pi-grok-build

Last updated: 2026-05-24

## Current reality

`pi-grok-build` is now a real Pi provider integration for the local Grok Build CLI, with JSONL as the default path and ACP available as a selectable comparison path.

The repo is intentionally not considered final-release complete until the release checklist is run fresh, but the earlier fake-green state has been corrected.

## Proven so far

- `grok` is called from `PATH` only.
- The provider uses real `grok models` output instead of generic xAI model guesses.
- The valid local model is `grok-build`; `grok-4.3` was proven invalid and is no longer advertised.
- The JSONL parser handles current Grok CLI events:
  - `thought`
  - `text`
  - `end`
  - top-level errors
- The provider maps visible text and thinking into Pi assistant stream events.
- Real Pi text print mode has produced `PI_GROK_OK` through `pi -p`.
- Real Pi JSON print mode has emitted parseable JSON events containing `PI_GROK_OK`.
- Real Pi RPC mode has emitted JSONL events containing `PI_GROK_OK`.
- Selectable ACP mode has produced visible `PI_GROK_OK` through Pi print mode.
- Missing CLI, invalid model, auth/subprocess/timeout/parse failures are categorized and surfaced through Pi stream `error` events.
- Unit tests, property tests, Biome checks, and manual Grok/Pi e2e tests exist and have passed during the rebuild sessions.

## Current supported surface

### Provider

- Provider id: `pi-grok-build`
- Primary model: `pi-grok-build/grok-build`
- Model list source: `grok models`, with fallback only when registration needs to keep diagnostic tools visible
- Input: text only
- Reasoning: Grok `thought`/ACP thought chunks mapped to Pi thinking events

### Integration modes

- `PI_GROK_BUILD_MODE=jsonl` — default, one-shot `grok -p --output-format streaming-json`
- `PI_GROK_BUILD_MODE=acp` — fresh `grok agent --no-leader --always-approve --model <model> stdio` process/session per provider call

See `docs/integration-modes.md`.

### Tools

Always registered:

- `grok_inspect`
- `grok_models`
- `grok_run`
- `grok_sessions`
- `grok_memory`

Registered only when `XAI_API_KEY` or `GROK_CODE_XAI_API_KEY` is configured:

- `grok_imagine_image`
- `grok_imagine_video`
- `grok_imagine_video_status`

Not shipped:

- Grok subagent provider behavior
- `best-of-n` provider behavior
- voice/TTS/STT tools
- provider image input

## Known limitations / release blockers

- Branch is local-only until explicitly pushed/released.
- Final release bead still needs a fresh completion audit and release verification.
- RPC mode now has automated e2e evidence through `test/e2e/manual/pi-runtime.e2e.test.ts`.
- Interactive mode should still be manually smoked before final release if the release claim includes interactive TUI behavior.
- ACP mode is functional but not persistent; each provider call starts a fresh ACP process/session.
- xAI media tools are grounded and API-key gated, but live media generation has not been run in this environment because no xAI API key is configured.
- `bd ready` still warns `beads.role not configured`; this does not block extension tests but should be cleaned up eventually with `git config beads.role maintainer` or `contributor`.

## Verification commands

CI-safe:

```bash
npm run format:check
npm run lint
npm run check
npm run test:ci
```

Manual local Grok/Pi:

```bash
PATH="$HOME/.grok/bin:$PATH" npm run test:e2e
```

Direct Pi smoke:

```bash
pi --no-extensions \
  --extension .pi/extensions/pi-grok-build/index.ts \
  --model pi-grok-build/grok-build \
  -p --no-session --no-context-files \
  "Respond exactly PI_GROK_OK and nothing else."
```

```bash
pi --no-extensions \
  --extension .pi/extensions/pi-grok-build/index.ts \
  --mode json \
  --model pi-grok-build/grok-build \
  -p --no-session --no-context-files \
  "Respond exactly PI_GROK_OK and nothing else."
```

Optional ACP smoke:

```bash
PI_GROK_BUILD_MODE=acp pi --no-extensions \
  --extension .pi/extensions/pi-grok-build/index.ts \
  --model pi-grok-build/grok-build \
  -p --no-session --no-context-files \
  "Respond exactly PI_GROK_OK and nothing else."
```

Optional live media smoke:

```bash
PI_GROK_BUILD_RUN_MEDIA_E2E=1 XAI_API_KEY=... npm run test:e2e:grok -- test/e2e/manual/xai-media.e2e.test.ts
```

## Next beads

- `pgb-011` — documentation and release criteria (current session)
- `pgb-012` — final release acceptance audit, package/live config update, publish/release if explicitly requested
