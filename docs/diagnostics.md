# Diagnostics and error surfacing

`pi-grok-build` uses Pi-native stream errors for provider failures and pino-backed structured logs for diagnostics. Pi's current extension API exposes UI notifications and stream events, but not a lazy debug logger primitive, so diagnostics are opt-in through environment variables.

## Environment

- `PI_GROK_BUILD_LOG_LEVEL=silent|error|warn|info|debug|trace`
  - Defaults to `error` to avoid noisy stdout/stderr during normal Pi and test runs.
  - `debug` includes lifecycle details such as provider start, selected model, sanitized Grok argv, and subprocess failures.
  - `trace` also records ignored non-JSON stream lines without logging token text.
- `PI_GROK_BUILD_DEBUG=1`
  - Shortcut for `PI_GROK_BUILD_LOG_LEVEL=debug` when `PI_GROK_BUILD_LOG_LEVEL` is not set.

## Redaction

Diagnostics intentionally redact prompt-bearing argv fields before logging:

- `-p <prompt>`
- `--prompt-json <json>`
- `--system-prompt-override <prompt>`

Tests assert redaction behavior and error classification behavior, not log output text.

## User-facing failures

Provider failures are surfaced as Pi assistant stream `error` events with categorized messages:

- missing Grok CLI on `PATH`
- invalid/unknown model IDs
- authentication/login problems
- subprocess timeouts
- non-zero subprocess exits
- unknown Grok CLI failures

Extension registration is intentionally best-effort: commands, tools, and a fallback `grok-build` provider model can still register when `grok` is missing, so `/grok status` and tool calls can explain what is wrong instead of disappearing silently. Actual provider inference still fast-fails through the stream if `grok` is unavailable on `PATH`.
