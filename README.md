# pi-grok-build

Pi coding-agent extension providing Grok Build / Grok CLI integration.

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

## Integration modes

Default provider mode is the proven JSONL path:

```bash
PI_GROK_BUILD_MODE=jsonl
```

ACP mode is also available for local comparison through Grok's stdio JSON-RPC surface:

```bash
PI_GROK_BUILD_MODE=acp
```

See [`docs/integration-modes.md`](docs/integration-modes.md) for the tradeoffs and current ACP limitations.

## Image and video tools

If `XAI_API_KEY` or `GROK_CODE_XAI_API_KEY` is configured, the extension registers xAI Imagine tools for image generation, video generation, and video status polling. Without an API key, these tools are intentionally not registered so Pi does not advertise a fake media surface.

See [`docs/media-tools.md`](docs/media-tools.md) for endpoint evidence, shipped behavior, and verification status.

## Diagnostics

Provider failures are surfaced as Pi stream `error` events. Structured pino diagnostics are opt-in with `PI_GROK_BUILD_LOG_LEVEL=silent|error|warn|info|debug|trace` or `PI_GROK_BUILD_DEBUG=1`; prompt-bearing Grok argv fields are redacted before logging.

See [`docs/diagnostics.md`](docs/diagnostics.md) for the full behavior.

## Tests

CI runs only deterministic tests that do not require a locally installed or authenticated Grok CLI:

```bash
npm run test:ci
```

Run the real Grok CLI integration suite manually on a machine where `grok` is installed and authenticated:

```bash
npm run test:grok
```

Run everything locally with:

```bash
npm test
```
