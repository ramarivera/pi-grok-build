# pi-grok-build

Pi coding-agent extension providing a Grok Build provider backed by the local `grok` CLI.

## What works

- Provider: `pi-grok-build/grok-build`
- Model discovery from the real `grok models` output
- Pi runtime paths:
  - interactive Pi uses the registered provider
  - text print: `pi -p`
  - JSON print: `pi --mode json -p`
  - RPC mode should use the same provider registry path; final release still needs explicit RPC acceptance evidence
- Integration modes:
  - JSONL: `grok -p ... --output-format streaming-json`
  - ACP: `grok agent ... stdio`
- Reasoning/thinking chunks mapped into Pi thinking events
- `grok_inspect`, `grok_models`, `grok_run`, `grok_sessions`, and `grok_memory` diagnostic tools
- Optional xAI Imagine image/video tools when an xAI API key is configured

## Hard boundaries

- The extension calls `grok` from `PATH` only. It does not search `~/.grok/bin` or any private install path.
- Grok subagents and `best-of-n` are out of provider scope.
- Provider input is text-only until real Grok CLI/provider image input is proven.
- xAI media tools use documented xAI API keys; they do not read or reuse private Grok CLI cached tokens from `~/.grok`.
- Voice/TTS/STT tools are not shipped because the previous endpoints were not grounded in current evidence.

## Install

```bash
npm install @ramarivera/pi-grok-build
```

Then add to your Pi agent settings:

```json
{
  "packages": ["@ramarivera/pi-grok-build"]
}
```

Make sure the Pi runtime shell can find `grok`:

```bash
grok --version
grok models
```

If `grok` is missing or unauthenticated, provider calls fail fast with a Pi-visible stream error.

## Integration modes

Default provider mode is the proven JSONL path:

```bash
PI_GROK_BUILD_MODE=jsonl
```

ACP mode is available for comparison through Grok's stdio JSON-RPC surface:

```bash
PI_GROK_BUILD_MODE=acp
```

`PI_GROK_BUILD_INTEGRATION_MODE` is accepted as a compatibility alias, but `PI_GROK_BUILD_MODE` wins.

See [`docs/integration-modes.md`](docs/integration-modes.md) for the tradeoffs and ACP limitations.

## Image and video tools

If `XAI_API_KEY` or `GROK_CODE_XAI_API_KEY` is configured, the extension registers xAI Imagine tools:

- `grok_imagine_image`
- `grok_imagine_video`
- `grok_imagine_video_status`

Without an API key, these tools are intentionally not registered so Pi does not advertise a fake media surface.

See [`docs/media-tools.md`](docs/media-tools.md) for endpoint evidence, shipped behavior, and verification status.

## Diagnostics

Provider failures are surfaced as Pi stream `error` events. Structured pino diagnostics are opt-in:

```bash
PI_GROK_BUILD_LOG_LEVEL=silent|error|warn|info|debug|trace
PI_GROK_BUILD_DEBUG=1
```

Prompt-bearing Grok argv fields are redacted before logging. Tests assert behavior and structured outputs, not log text.

See [`docs/diagnostics.md`](docs/diagnostics.md) for the full behavior.

## Tests

CI-safe deterministic suite:

```bash
npm run test:ci
```

Formatting/lint/typecheck gate:

```bash
npm run format:check
npm run lint
npm run check
```

Manual real Grok/Pi suite on a machine where `grok` and `pi` are installed/authenticated:

```bash
PATH="$HOME/.grok/bin:$PATH" npm run test:e2e
```

Opt-in xAI media smoke, which can incur API usage:

```bash
PI_GROK_BUILD_RUN_MEDIA_E2E=1 XAI_API_KEY=... npm run test:e2e:grok -- test/e2e/manual/xai-media.e2e.test.ts
```

See [`docs/testing.md`](docs/testing.md) for suite boundaries.

## Release gate

Do not claim this extension is ready for release just because `test:ci` passes. Before release, follow [`docs/release-checklist.md`](docs/release-checklist.md), including real Pi runtime smoke for text and JSON modes and any required live xAI media smoke if media tools are part of the release claim.
