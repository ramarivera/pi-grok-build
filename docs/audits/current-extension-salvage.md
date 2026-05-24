# pi-grok-build current extension salvage audit

Bead: `pgb-001` — Audit current extension code for salvageable reality-grounded pieces  
Date: 2026-05-24

## Scope

This audit answers whether the current extension code is useful for the reality-grounded rebuild goal, and classifies current modules/tests as:

- **Keep** — usable with minor cleanup.
- **Rewrite around** — useful intent or fragments exist, but current implementation is not trustworthy enough as-is.
- **Quarantine** — do not advertise/use until separately proven.
- **Delete/replace** — actively wrong for the goal.

The goal is not to fix implementation here. This is a salvage decision artifact only.

## High-level verdict

The repo is **not worthless**, but the current extension is **not trustworthy as a Pi provider**.

Useful pieces exist mostly as *raw ingredients*:

- Type definitions for real current Grok JSONL events (`thought`, `text`, `end`).
- A basic line parser that safely ignores non-JSON noise.
- Some CLI arg mapping knowledge from `grok --help`.
- A Pi SDK e2e harness pattern that proves the extension can be discovered by a local `.pi` fixture.
- A working mental split between deterministic CI tests and real local Grok tests.

The dangerous pieces are the ones that make the extension look more complete than it is:

- Provider lifecycle and stream termination are overgrown and still unproven through real Pi CLI modes.
- Binary detection currently hunts private install paths; the goal requires PATH-only fast fail.
- `grok_run` builds shell strings unsafely from args.
- Image/video/TTS/STT are xAI REST guesses, not proven Grok CLI/provider features.
- Tests over-assert registration/export shape and under-assert actual Pi runtime behavior.

## File-by-file classification

| File | Classification | Keep? | Rationale | Required follow-up |
|---|---|---:|---|---|
| `CURRENT_STATE.md` | Keep | ✅ | Honest damage assessment and acceptance criteria. | Keep updated or supersede with docs once implementation is real. |
| `package.json` | Rewrite around | ⚠️ | Package metadata/scripts are a decent start, but scripts lack property tests, Biome, real e2e split, and Effect/pino deps. | Rework in test/tooling beads. |
| `src/grok-parser.ts` | Keep with cleanup | ✅ | `parseGrokLine` is small, safe, and handles real `text/thought/end` events. | Add fast-check property tests for never-throw behavior and event classifier invariants. |
| `src/types.ts` | Rewrite around | ⚠️ | Contains useful real event types, but mixes old imagined `assistant/result` protocol, dangerous/out-of-scope options (`bestOfN`, subagents), and stale comments. | Split current JSONL protocol from legacy/experimental types; remove out-of-scope provider options. |
| `src/grok-runner.ts` | Rewrite around / partial delete | ⚠️/❌ | `buildGrokArgs` has useful flag mapping, but `detectGrokBinary` violates PATH-only requirement, `runGrokCommand` uses unsafe shell string joining, and several wrappers call wrong/incomplete subcommands (`sessions`, `memory`, `trace`) without required args/subcommands. | Replace detection with PATH-only `grok`; use spawn/execFile style args; limit command wrappers to proven safe subcommands. |
| `src/provider.ts` | Rewrite around | ⚠️ | Captures core idea and real `text/thought/end` parsing, but lifecycle is too complex, has forced process kill on `end`, type errors, unproven Pi event semantics, and includes out-of-scope options. | Rebuild minimal JSONL provider after Pi contract bead. Reuse parser concepts, not whole file blindly. |
| `src/grok-bridge.ts` | Quarantine | 🧊 | It bridges an older `assistant`/delta shape that is not the current Grok CLI JSONL output. Might be useful only if ACP or another mode emits that shape, but not proven. | Do not use for JSONL MVP unless real evidence says this protocol appears. |
| `src/extension.ts` | Rewrite around | ⚠️ | Has Pi registration shape and useful tool/command ideas, but catches registration failures with `console.error` only, advertises too many unproven tools, and startup validation can suppress the whole extension. | Rebuild with honest provider registration, safe diagnostic tools, Pi-idiomatic errors/logging. |
| `src/xai-api.ts` | Quarantine | 🧊 | It is separate from Grok CLI and assumes endpoints/models (`grok-2-image`, `grok-2-video`, `/v1/tts`, `/v1/stt`) without proof. | Keep only as scratch/reference. Image/video tools require separate auth/API research bead. |
| `src/index.ts` | Rewrite around | ⚠️ | Useful exports, but currently exports unproven/quarantined surfaces. | Export only honest supported surfaces per release stage. |
| `.pi/extensions/pi-grok-build/index.ts` | Keep pattern | ✅ | Local Pi fixture pattern is valuable for e2e discovery. | Move/duplicate into `tests/e2e/.pi` if that proves cleaner; assert real `-p`/JSON modes. |
| `test/pi-grok-build.sdk.e2e.test.ts` | Keep pattern, strengthen | ✅/⚠️ | Actually uses Pi SDK resource loading and live extension runner; this is one of the best existing test patterns. But it only checks discovery/tools, not provider output. | Expand into real runtime provider e2e. |
| `test/grok-runner.test.ts` | Rewrite around | ⚠️ | Arg mapping tests are useful, but include invalid `grok-3`, real CLI calls in the wrong suite, and stale binary expectations. | Split pure unit arg tests from manual local CLI tests. Remove out-of-scope subagent/bestOfN provider coverage. |
| `test/provider.test.ts` | Rewrite around | ⚠️ | Basic prompt/context helpers tested, but not real stream behavior. | Replace/augment with stream fixture tests from captured real JSONL. |
| `test/grok-bridge.test.ts` | Quarantine | 🧊 | Tests older/imagined `assistant` event bridge, not current JSONL MVP. | Keep only if ACP/reference research proves relevance. |
| `test/pi-grok-build.e2e.test.ts` | Rewrite around | ⚠️ | Misnamed as e2e; mostly export/registration shape. Contains fake-green behavior and invalid model usage. | Replace with separate unit/integration/e2e suites. |
| `test/pi-grok-build.test.ts` | Keep small parts | ⚠️ | Parser never-throw tests are useful; old protocol tests should be separated from current JSONL tests. | Convert parser tests into unit/property tests. |
| `test/xai-api.test.ts` | Quarantine | 🧊 | Only validates missing-key errors for unproven endpoints. | Keep out of CI claims until image/video API research is complete. |
| `.github/workflows/publish.yml` | Not audited in detail | ⚠️ | Prior context says CI/manual split exists. | Revisit after new test architecture is defined. |
| `README.md` | Rewrite | ❌ | Current docs likely over-advertise. | Rewrite after implementation stages are real. |

## Salvageable architecture pieces

### Keep as ingredients

1. **Safe line parser concept**
   - `parseGrokLine` returning `null` on non-JSON/malformed lines is exactly the right posture.

2. **Current JSONL event type awareness**
   - `text`, `thought`, and `end` support is real and should be centered.

3. **Arg builder table knowledge**
   - `buildGrokArgs` knows many flags, but MVP should expose only a tiny subset.

4. **Pi SDK local fixture pattern**
   - Existing SDK e2e shows how to load `.pi/extensions/pi-grok-build/index.ts` through `DefaultResourceLoader`.

5. **Manual-vs-CI split idea**
   - Correct principle: deterministic tests in CI, real local Grok/Pi e2e manual-gated unless auth is available.

### Do not keep as-is

1. **Binary detection fallback**
   - Violates the goal. The extension must call `grok` on PATH and fast-fail.

2. **Full provider lifecycle implementation**
   - Too much complexity before Pi contract is known. Rebuild small.

3. **xAI REST media/voice tools**
   - Unverified endpoint/model/auth assumptions. Quarantine.

4. **Arbitrary `grok_run`**
   - Unsafe shell-string execution and too broad. Replace with whitelisted commands or safe spawn args.

5. **Old `assistant/result` bridge as default path**
   - Not current Grok JSONL. Keep only as research artifact.

## Recommended next implementation stance

For the JSONL MVP, write a smaller core rather than trying to repair the current provider in place:

1. `resolveGrokCommand()` returns literal `"grok"` or simply uses `spawn("grok", ...)`; no private path probing.
2. `buildJsonlArgs()` supports only:
   - `-p <prompt>`
   - `--model <id>`
   - `--output-format streaming-json`
   - `--cwd <cwd>` when supported/needed
   - `--max-turns 1`
   - `--no-plan`
   - `--no-subagents`
   - maybe `--no-memory` for deterministic mode
3. Parser handles only proven current events for MVP:
   - `thought`
   - `text`
   - `end`
   - top-level `error` if observed
   - stderr/process errors
4. Provider emits Pi events according to the real Pi contract from `pgb-002`.
5. Only register honest tools initially:
   - `grok_inspect`
   - `grok_models`
   - maybe `grok_version/status`
6. Leave sessions, MCP, plugins, image/video, ACP, and arbitrary run for later beads.

## Follow-up beads already covering gaps

- `pgb-002` — Required before finalizing provider event semantics.
- `pgb-003` — Required before ACP and edge-case decisions.
- `pgb-004` — Minimal JSONL provider.
- `pgb-006` — Real test architecture.
- `pgb-008` — Error/logging surfacing.
- `pgb-010` — Image/video tools.

No additional beads are required from this audit yet; existing backlog covers the discovered gaps.

## Acceptance for pgb-001

This file satisfies `pgb-001` because it:

- Classifies current code file-by-file.
- Separates useful pieces from fake-green surfaces.
- Identifies which modules are unsafe or unproven.
- Recommends what to keep/rewrite/quarantine/delete.
- Avoids implementation changes beyond documentation and bead tracking.
