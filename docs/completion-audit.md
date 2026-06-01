# Completion audit

Bead: `pgb-012` — final runtime acceptance and release gate.

Date: 2026-06-01

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
| Track with Beads | `.beads/issues.jsonl`; Beads `pgb-001` through `pgb-011` closed, `pgb-012` claimed for final audit | Done / ongoing |
| Use local Grok Build CLI/provider | `src/provider.ts`, `src/grok-runner.ts`; runtime e2e in `test/e2e/manual/pi-runtime.e2e.test.ts` | Done |
| Use real `grok-build` model, not fake IDs | `src/model-metadata.ts`; `docs/contracts/pi-platform-contract.md`; `grok models` evidence captured in docs | Done |
| Pi text print mode | `test/e2e/manual/pi-runtime.e2e.test.ts` asserts `pi -p` contains `PI_GROK_OK`; latest run passed | Done |
| Pi JSON print mode | Same e2e asserts `pi --mode json -p` emits parseable events containing `PI_GROK_OK`; latest run passed | Done |
| Pi RPC mode | Same e2e spawns `pi --mode rpc`, sends JSONL `prompt`, asserts `turn_end`/`PI_GROK_OK`; latest run passed | Done |
| Pi interactive mode | Same provider registry path is used; `pi --help` confirms interactive mode exists; no automated TUI smoke captured | Weak / manual-only |
| Pi MCP/ACP/RCP confusion resolved | `docs/contracts/pi-platform-contract.md` documents Pi modes as text/json/rpc and Grok ACP as integration mode, not Pi mode | Done |
| Exclude Grok subagents and best-of-n | `buildSpawnOptions` defaults, property tests, docs/release checklist | Done |
| Unit tests | `test/unit/**/*.test.ts`; 2026-06-01 `npm run test:ci` passed | Done |
| Property tests with fast-check | `test/property/**/*.property.test.ts`; `fast-check` dependency; 2026-06-01 `npm run test:ci` passed | Done |
| Actual Pi e2e tests | `test/e2e/sdk`, `test/e2e/manual`, project-local `.pi/extensions/pi-grok-build/index.ts`; 2026-06-01 `PATH="$HOME/.grok/bin:$PATH" npm run test:e2e` passed after auth-cache test isolation fix | Done |
| Biome lint/prettify | `biome.json`, package scripts; 2026-06-01 `npm run format:check` and `npm run check` passed | Done |
| Effect TS where useful | `effect` dependency; `detectGrokBinaryEffect()` models PATH detection errors | Done |
| Pi platform integration surfaces | `docs/contracts/pi-platform-contract.md` maps provider/tool/error/logging/cost surfaces; provider usage reports zero/unknown where Grok lacks JSONL usage; ACP maps usage when returned | Done with honest limitations |
| Context research over DP Code/OpenCode | `docs/research/dpcode-opencode-grok-integration.md`; Bead `pgb-003` closed; cache verified under `~/.context` on 2026-06-01 (`dpcode` `77e01ebd`, `opencode` `0cf99cf5f`, BTCA config uses `opencode`/`gpt-5.3-codex-spark`) | Done |
| Image/video tools grounded | `docs/media-tools.md`, `src/xai-api.ts`, tests; old fake TTS/STT removed; `~/.grok/auth.json` auth.x.ai `key` fallback implemented after `/v1/models` probe succeeded | Done for gated API surface |
| Live media generation | `test/e2e/manual/xai-media.e2e.test.ts` exists; live generation still intentionally opt-in because it can incur xAI usage | Pending opt-in smoke |
| Pi-idiomatic error reporting | Provider emits Pi assistant stream `error` events; `src/diagnostics.ts`; unit tests | Done |
| PATH-only Grok detection | `detectGrokBinary()` calls `grok` on PATH only; no private fallback | Done |
| Pino diagnostics if Pi lacks logger primitive | `src/diagnostics.ts`, `docs/diagnostics.md`; redaction tests; logs not test oracle | Done |
| Reasoning support | JSONL `thought` and ACP thought chunks mapped to Pi thinking events; tests/docs | Done |
| Grok inspect support | `grok_inspect` / `grok_models` tools; e2e/tool tests | Done |
| JSONL + ACP selectable mode | `PI_GROK_BUILD_MODE=jsonl|acp`, alias `PI_GROK_BUILD_INTEGRATION_MODE`; `docs/integration-modes.md`; ACP e2e smoke | Done |
| Package docs included | `package.json.files` includes `docs`; 2026-06-01 `npm pack --dry-run` included docs and package version `0.1.5` after the audit/test fix version bump | Done |
| Published package contains current release | `npm view @ramarivera/pi-grok-build version dist-tags versions --json` reports `latest: 0.1.4`; `npm view @ramarivera/pi-grok-build@0.1.4 dist --json` reports the tarball integrity/signature | Done |
| Trusted publishing workflow | `.github/workflows/publish.yml` grants `id-token: write`; GitHub Actions run `26672506988` for commit `9e08ea0` succeeded and ran `Publish to npm`; run `26735929373` for current HEAD `dbc2347` succeeded and skipped publish because the version already exists | Done |
| Live Pi settings use current package | `~/.pi/agent/settings.json` and toolbox `home/.chezmoidata/pi-agent.yaml` both reference `npm:@ramarivera/pi-grok-build@0.1.4` | Done |
| Push/release | `git status --short --branch` shows `main...origin/main` at the start of 2026-06-01 audit; release `0.1.4` already exists | Done before this audit edit |
| Clean worktree | Current audit/test/doc/version changes are WIP until committed/pushed | Pending this checkpoint |

## Verification evidence from this session/round

Commands run during the 2026-06-01 audit:

```bash
npm run format:check
npm run check
npm run test:ci
PATH="$HOME/.grok/bin:$PATH" npm run test:e2e
npm pack --dry-run
```

Result:

- `format:check`: pass
- `check`: pass, including Biome and TypeScript
- `test:ci`: pass, including TypeScript, 67 unit tests, and 9 property tests
- `test:e2e`: pass, 77 tests / 0 failures; xAI live media suite skipped because `PI_GROK_BUILD_RUN_MEDIA_E2E=1` was not set
- `npm pack --dry-run`: pass; package tarball includes `src`, `docs`, `README.md`, `LICENSE`, and `package.json`

The real Pi runtime e2e suite covers:

  - `pi -p`
  - `pi --mode json -p`
  - `PI_GROK_BUILD_MODE=acp` print mode
  - `pi --mode rpc`

Publication state check:

```bash
npm view @ramarivera/pi-grok-build version dist-tags versions --json
npm view @ramarivera/pi-grok-build@0.1.4 dist --json
gh run view 26672506988 --json conclusion,status,headSha,event,createdAt,updatedAt,url,jobs
```

Result:

- npm published version/latest dist-tag: `0.1.4`
- package integrity: `sha512-rC+UKyQUNZFIB[...]vkf33+DqG6Pdw==`
- publish workflow: success for commit `9e08ea0a939b4b1b7abedc1a0a10a6e783bd4b87`; `Publish to npm` step succeeded

## Gaps / blockers before marking the goal complete

1. **Release candidate `0.1.5` is not published yet.** The version bump exists locally and must be committed, pushed, and verified through trusted publishing.
2. **Live media generation is not proven.** The media surface is honest and gated; Grok cached access-token auth was proven against `/v1/models`, but real image/video generation remains opt-in because it can incur xAI usage.
3. **Interactive TUI is not manually smoked in this audit.** Non-interactive text/json/rpc and ACP integration are proven; interactive relies on the same provider registry path but still lacks a recorded manual smoke.
4. **Current WIP is not committed/pushed.** The audit/test/docs/version updates need the normal verification, commit, and push path before the worktree is clean.

## Current conclusion

The implementation and `0.1.4` release are already published and wired into live Pi settings. The overall goal is **not complete yet** inside this resumed audit because the stale no-media-auth e2e expectation has been fixed, `0.1.5` has been prepared, and the commit/push/trusted-publishing verification sequence still needs to run.

Next productive action: commit and push the `0.1.5` audit/test correction, verify the trusted publishing workflow publishes `0.1.5`, update live Pi package references if needed, then close `pgb-012` and mark the persisted goal complete.
