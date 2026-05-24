# Testing pi-grok-build

The test layout is intentionally split by risk level.

## CI-safe suites

Run these before publishing or changing provider logic:

```bash
npm run test:ci
```

`test:ci` runs:

- `npm run typecheck`
- `npm run test:unit`
- `npm run test:property`

### Unit tests

```bash
npm run test:unit
```

Unit tests live under `test/unit/`. They must be deterministic and must not require a logged-in Grok CLI, local Pi config, network access, or real model calls.

### Property tests

```bash
npm run test:property
```

Property tests live under `test/property/` and use `fast-check`. They cover parser/argument/model-output invariants such as:

- arbitrary input never crashes `parseGrokLine`
- current Grok JSONL `thought`/`text`/`end` shapes round-trip through type guards
- prompts remain a single argv element and are not shell-joined
- out-of-scope orchestration flags (`--agent`, `--agents`, `--best-of-n`, `--worktree`) are not emitted by provider args
- model discovery parsing deduplicates model IDs

## Manual/local e2e suites

These require local machine state and are intentionally not run in CI by default.

```bash
PATH="$HOME/.grok/bin:$PATH" npm run test:e2e
```

`test:e2e` runs both SDK and live Grok/Pi e2e suites.

### SDK e2e

```bash
npm run test:e2e:sdk
```

SDK e2e tests live under `test/e2e/sdk/`. They use Pi SDK runtime APIs and the project-local `.pi/extensions/pi-grok-build/index.ts` shim to prove the extension can be discovered and bound.

### Real Grok/Pi e2e

```bash
PATH="$HOME/.grok/bin:$PATH" npm run test:e2e:grok
```

Manual Grok e2e tests live under `test/e2e/manual/`. They require:

- `grok` available on `PATH`
- local Grok CLI auth already completed
- `pi` available on `PATH`

The real Pi runtime test asserts both:

- `pi -p` with `pi-grok-build/grok-build` visibly outputs `PI_GROK_OK`
- `pi --mode json -p` emits parseable JSON events containing `PI_GROK_OK`

Tests assert observable behavior and structured output. Logs are allowed for diagnosis, but no test should depend on log text as its primary expectation.
