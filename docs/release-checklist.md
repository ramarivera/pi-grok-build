# Release checklist

Bead: `pgb-011` — release criteria documentation.

This checklist is the gate before saying `pi-grok-build` is ready, published, or complete. Do not substitute CI success for real runtime evidence.

## 1. Scope audit

Confirm the release claim matches the actual shipped surface:

- Provider: `pi-grok-build/grok-build`
- Default integration: `PI_GROK_BUILD_MODE=jsonl`
- Optional integration: `PI_GROK_BUILD_MODE=acp`
- Always-available tools:
  - `grok_inspect`
  - `grok_models`
  - `grok_run`
  - `grok_sessions`
  - `grok_memory`
- API-key-gated tools:
  - `grok_imagine_image`
  - `grok_imagine_video`
  - `grok_imagine_video_status`
- Explicitly out of scope:
  - Grok subagents as provider behavior
  - `best-of-n`
  - provider image input
  - TTS/STT/voice tools
  - private `~/.grok` binary or token spelunking

## 2. Local prerequisites

```bash
grok --version
grok models
pi --version
```

Expected model evidence:

- `grok-build` appears in `grok models`
- no release docs or settings advertise invalid `grok-4.3`

## 3. Deterministic checks

```bash
npm run format:check
npm run lint
npm run check
npm run test:ci
```

`test:ci` must include unit and fast-check property tests. It does **not** prove live Pi runtime behavior.

## 4. Manual Grok/Pi e2e

```bash
PATH="$HOME/.grok/bin:$PATH" npm run test:e2e
```

This must pass:

- SDK extension discovery
- real Grok CLI command tests
- real `pi -p` provider output containing `PI_GROK_OK`
- real `pi --mode json -p` JSON events containing `PI_GROK_OK`
- selectable ACP mode provider output containing `PI_GROK_OK`

## 5. Direct smoke commands

Run these if a full e2e suite failure needs narrowing or before final release notes.

Text print:

```bash
pi --no-extensions \
  --extension .pi/extensions/pi-grok-build/index.ts \
  --model pi-grok-build/grok-build \
  -p --no-session --no-context-files \
  "Respond exactly PI_GROK_OK and nothing else."
```

JSON print:

```bash
pi --no-extensions \
  --extension .pi/extensions/pi-grok-build/index.ts \
  --mode json \
  --model pi-grok-build/grok-build \
  -p --no-session --no-context-files \
  "Respond exactly PI_GROK_OK and nothing else."
```

ACP mode:

```bash
PI_GROK_BUILD_MODE=acp pi --no-extensions \
  --extension .pi/extensions/pi-grok-build/index.ts \
  --model pi-grok-build/grok-build \
  -p --no-session --no-context-files \
  "Respond exactly PI_GROK_OK and nothing else."
```

## 6. Error smoke

At minimum, verify one provider failure becomes visible as a Pi stream error rather than empty success. Examples:

- remove `grok` from `PATH` for a provider call
- use an intentionally invalid model id in a direct provider/unit test

Expected: user-visible categorized error message, not blank `done`.

## 7. Optional media release claim

Only if the release notes claim live image/video tools are working, run:

```bash
PI_GROK_BUILD_RUN_MEDIA_E2E=1 XAI_API_KEY=... npm run test:e2e:grok -- test/e2e/manual/xai-media.e2e.test.ts
```

If no xAI API key is available, say media tools are documented/gated/deterministically tested but not live-smoked in this environment.

## 8. Packaging/source-of-truth

Before publishing:

- Ensure `package.json` version is new; npm versions are immutable.
- Ensure `package.json.files` includes `src`, `docs`, `README.md`, and `LICENSE` so README doc links work on npm.
- Run `npm pack --dry-run` and inspect included files.
- Confirm live Pi settings and toolbox source-of-truth are updated only after the package version exists.

## 9. Final completion audit

Before marking the overall goal complete, build a prompt-to-artifact checklist for every original requirement:

- Beads created and used across sessions.
- Current extension code audited for salvageable pieces.
- Pi provider works through actual supported modes, not just unit tests.
- Grok Build CLI and `grok-build` model are the real inference path.
- Subagents and `best-of-n` are excluded from provider scope.
- Unit, property, SDK e2e, and real Pi e2e suites exist and pass at the right gate.
- Biome lint/format checks pass.
- Effect TS is used where it improves typed error handling without making the synchronous Pi provider path weird.
- Pi integration surfaces are used where available, and missing surfaces are documented.
- DP Code/OpenCode prior art was researched and captured.
- Image/video tools are either live-proven or honestly documented as API-key gated with live smoke pending.
- Error reporting surfaces real failures through Pi stream errors.
- `grok` PATH ownership stays outside the extension.
- Diagnostics are opt-in, redacted, and not used as test expectations.
- JSONL and ACP modes are documented with limitations.
- Worktree is clean, and any WIP is preserved in an honest commit.

If any item is missing, incomplete, or only weakly verified, keep the goal open and create/follow the next bead instead of claiming completion.
