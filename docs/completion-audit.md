# Completion audit

Bead: `pgb-012` — final runtime acceptance and release gate.

Date: 2026-05-24

## Objective restated as concrete success criteria

`pi-grok-build` is done only when all of this is true:

1. The old extension code was audited for reality-grounded salvage value.
2. Progress is tracked through Beads across sessions.
3. Pi can use the local `grok` CLI and real `grok-build` model as an inference provider.
4. Actual Pi modes are handled with evidence, especially interactive, `-p`, `--mode json`, and `--mode rpc`.
5. Grok subagents and `best-of-n` are excluded from provider scope.
6. Tests are real and split into normal unit tests, fast-check property tests, and actual Pi e2e tests using the project-local `.pi` shim.
7. Biome lint/format gates exist and pass.
8. Effect TS is used where useful instead of gratuitously reshaping the Pi provider.
9. Pi platform integration surfaces are used where available, and missing surfaces are documented.
10. DP Code and OpenCode prior art was researched before building weird/edge Grok behavior.
11. Image/video tools are grounded in real CLI/API/auth behavior, with no fake media surface.
12. Provider errors surface idiomatically through Pi instead of silent success.
13. The extension assumes `grok` is on `PATH`; no private binary lookup tricks.
14. Diagnostics are useful, opt-in, redacted, and not used as test expectations.
15. Reasoning and `grok_inspect` are supported.
16. JSONL and ACP Grok integration modes are selectable and documented.
17. Package/release/live Pi installation is updated only after a real publishable package exists.
18. Worktree ends clean.

## Prompt-to-artifact checklist

| Requirement | Evidence | Status |
|---|---|---|
| Audit current extension code for useful pieces | `docs/audits/current-extension-salvage.md`; Bead `pgb-001` closed | Done |
| Track with Beads | `.beads/issues.jsonl`; Beads `pgb-001` through `pgb-011` closed, `pgb-012` open | Done / ongoing |
| Use local Grok Build CLI/provider | `src/provider.ts`, `src/grok-runner.ts`; runtime e2e in `test/e2e/manual/pi-runtime.e2e.test.ts` | Done |
| Use real `grok-build` model, not fake IDs | `src/model-metadata.ts`; `docs/contracts/pi-platform-contract.md`; `grok models` evidence captured in docs | Done |
| Pi text print mode | `test/e2e/manual/pi-runtime.e2e.test.ts` asserts `pi -p` contains `PI_GROK_OK`; latest run passed | Done |
| Pi JSON print mode | Same e2e asserts `pi --mode json -p` emits parseable events containing `PI_GROK_OK`; latest run passed | Done |
| Pi RPC mode | Same e2e spawns `pi --mode rpc`, sends JSONL `prompt`, asserts `turn_end`/`PI_GROK_OK`; latest run passed | Done |
| Pi interactive mode | Same provider registry path is used; `pi --help` confirms interactive mode exists; no automated TUI smoke captured | Weak / manual-only |
| Pi MCP/ACP/RCP confusion resolved | `docs/contracts/pi-platform-contract.md` documents Pi modes as text/json/rpc and Grok ACP as integration mode, not Pi mode | Done |
| Exclude Grok subagents and best-of-n | `buildSpawnOptions` defaults, property tests, docs/release checklist | Done |
| Unit tests | `test/unit/**/*.test.ts`; latest `npm run test:ci` passed | Done |
| Property tests with fast-check | `test/property/**/*.property.test.ts`; `fast-check` dependency; latest `npm run test:ci` passed | Done |
| Actual Pi e2e tests | `test/e2e/sdk`, `test/e2e/manual`, project-local `.pi/extensions/pi-grok-build/index.ts`; latest `npm run test:e2e` passed | Done |
| Biome lint/prettify | `biome.json`, package scripts; latest `npm run format:check` and `npm run check` passed | Done |
| Effect TS where useful | `effect` dependency; `detectGrokBinaryEffect()` models PATH detection errors | Done |
| Pi platform integration surfaces | `docs/contracts/pi-platform-contract.md` maps provider/tool/error/logging/cost surfaces; provider usage reports zero/unknown where Grok lacks JSONL usage; ACP maps usage when returned | Done with honest limitations |
| Context research over DP Code/OpenCode | `docs/research/dpcode-opencode-grok-integration.md`; Bead `pgb-003` closed | Done |
| Image/video tools grounded | `docs/media-tools.md`, `src/xai-api.ts`, tests; old fake TTS/STT removed; `~/.grok/auth.json` auth.x.ai `key` fallback implemented after `/v1/models` probe succeeded | Done for gated API surface |
| Live media generation | `test/e2e/manual/xai-media.e2e.test.ts` exists; live generation still intentionally opt-in because it can incur xAI usage | Pending opt-in smoke |
| Pi-idiomatic error reporting | Provider emits Pi assistant stream `error` events; `src/diagnostics.ts`; unit tests | Done |
| PATH-only Grok detection | `detectGrokBinary()` calls `grok` on PATH only; no private fallback | Done |
| Pino diagnostics if Pi lacks logger primitive | `src/diagnostics.ts`, `docs/diagnostics.md`; redaction tests; logs not test oracle | Done |
| Reasoning support | JSONL `thought` and ACP thought chunks mapped to Pi thinking events; tests/docs | Done |
| Grok inspect support | `grok_inspect` / `grok_models` tools; e2e/tool tests | Done |
| JSONL + ACP selectable mode | `PI_GROK_BUILD_MODE=jsonl|acp`, alias `PI_GROK_BUILD_INTEGRATION_MODE`; `docs/integration-modes.md`; ACP e2e smoke | Done |
| Package docs included | `package.json.files` includes `docs`; `npm pack --dry-run` included docs | Done |
| Published package contains current commits | `npm view @ramarivera/pi-grok-build version` = `0.1.1`; local package version prepared as `0.1.2`, but that version is not pushed/published yet | Not done |
| Live Pi settings use current package | `~/.pi/agent/settings.json` and toolbox `home/.chezmoidata/pi-agent.yaml` still point at `npm:@ramarivera/pi-grok-build@0.1.1`; they should move to `0.1.2` only after publish succeeds | Not done |
| Push/release | `git status` shows branch ahead of origin; no push requested in this goal continuation | Blocked by no explicit push/publish approval |
| Clean worktree | `git status --short --branch` before this audit was clean; this audit file is current WIP until committed | Pending this checkpoint |

## Verification evidence from this session/round

Commands run after the latest RPC e2e addition:

```bash
npm run format:check
npm run check
PATH=/Users/ramarivera/.grok/bin:$PATH npx tsx --test test/e2e/manual/pi-runtime.e2e.test.ts
```

Result:

- `format:check`: pass
- `check`: pass, including TypeScript
- `pi-runtime.e2e`: 4 tests pass:
  - `pi -p`
  - `pi --mode json -p`
  - `PI_GROK_BUILD_MODE=acp` print mode
  - `pi --mode rpc`

Earlier full e2e run after the same source changes:

```bash
PATH=/Users/ramarivera/.grok/bin:$PATH npm run test:e2e
```

Result: 77 pass / 0 fail; xAI media e2e skipped because no key is configured.

Packaging check:

```bash
npm pack --dry-run
```

Result: package tarball includes `src`, `docs`, `README.md`, `LICENSE`, and `package.json`.

Publication state check:

```bash
npm view @ramarivera/pi-grok-build version --silent
node -e "const p=require('./package.json'); console.log(p.version)"
git rev-parse HEAD
```

Result:

- npm published version: `0.1.1`
- local version prepared for next release: `0.1.2`
- local HEAD at audit creation: `1d8386bfa978968f98391cf95a0b142b66ddadaa`

## Gaps / blockers before marking the goal complete

1. **Current source is not published.** The local package has been bumped to `0.1.2`, but npm still has `0.1.1` until the branch is pushed and the publish workflow succeeds.
2. **Branch is ahead of origin.** The current working source is local-only until pushed.
3. **Live Pi settings point at `0.1.1`.** They cannot safely point at `0.1.2` until that package version is published or an explicit local/git source is chosen.
4. **Live media generation is not proven.** The media surface is honest and gated; Grok cached access-token auth was proven against `/v1/models`, but real image/video generation remains opt-in because it can incur xAI usage.
5. **Interactive TUI is not manually smoked in this audit.** Non-interactive text/json/rpc and ACP integration are proven; interactive relies on the same provider registry path but still lacks a recorded manual smoke.
6. **Push/publish needs explicit approval.** The standing instruction says do not push unless explicitly requested; npm publish/release is a shipping action.

## Current conclusion

The implementation is substantially complete and locally verified, including real Pi `-p`, JSON, RPC, and Grok ACP integration evidence. The overall goal is **not complete yet** because the verified source has not been pushed/published as the prepared `0.1.2` package version and live Pi settings still reference the old immutable `0.1.1` package.

Next productive action after approval: push the prepared `0.1.2` release commit, let trusted publishing publish, update toolbox/live Pi package to the new version, run post-install Pi smoke, close `pgb-012`, and only then mark the persisted goal complete.
