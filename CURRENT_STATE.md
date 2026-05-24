# CURRENT_STATE — pi-grok-build reality check

## What’s real

- `grok` exists, but **not reliably on PATH** for Pi/runtime shells.
  - Real binary works at `~/.grok/bin/grok`.
- Real installed Grok CLI version: `0.1.218`.
- Real CLI models:
  - `grok-build`
  - `kimi-k2p6-turbo-firepass`
- Real streaming format is:
  - `{"type":"thought","data":"..."}`
  - `{"type":"text","data":"..."}`
  - `{"type":"end", ...}`
- `grok-4.3` is rejected by the actual CLI.
- Direct CLI call with `grok-build --no-subagents` can emit real text.

## What was fake / fake-green

- **Advertised model list was wrong.**
  - Extension exposed `grok-4.3`, pulled from generic xAI assumptions/catalog vibes, not `grok models`.

- **Provider stream parser was wrong.**
  - It parsed older/imagined `assistant/result` events.
  - Actual CLI text events were ignored.
  - So Pi got an empty success. That’s your “nothing happens.”

- **Error surfacing was wrong.**
  - Invalid model produced empty `done` instead of a visible error.
  - This is the unforgivable UX bug.

- **Tests were not reality-rooted enough.**
  - They proved imports, arg building, registration shape, and some local CLI commands.
  - They did **not** prove “Pi provider selected in real Pi produces visible assistant text.”

- **CI split was necessary but also hid integration reality.**
  - `test:ci` is valid for publish safety.
  - But it must never be treated as “the extension works.”

## Current local patch state

There are uncommitted local changes in `~/dev/pi-grok-build`.

They attempt to fix:
- model discovery from real `grok models`
- parser support for `thought/text/end`
- visible stream errors
- binary fallback to `~/.grok/bin/grok`
- disabling Grok subagents by default for Pi provider calls

But they are **not ready**:
- `npm run typecheck` fails on one exact optional type issue.
- `npm run test:grok` fails one outdated assertion expecting binary exactly `"grok"` instead of a real path.
- Real `pi -p` output verification is still pending.
- Direct provider smoke did output `PI_GROK_OK` only after binary fallback + parser/subagent changes, but Pi CLI verification is still pending.

## Layering correction

The extension should **not** hardcode or search private Grok install locations like `~/.grok/bin/grok`.

If Grok CLI is installed for the user, toolbox/runtime environment should put `grok` on PATH. The extension should call `grok` and surface a real error if it is unavailable.

## What to do next — meaningful path

### Option A: salvage narrowly, recommended

Make this extension only one thing first:

> “Pi provider that calls local Grok Build CLI and streams visible text/errors.”

Cut scope temporarily:
- keep provider
- keep `/grok status/models/inspect`
- keep `grok_inspect` / `grok_models`
- treat image/video/TTS/STT helpers as **experimental or remove from advertised surface**
- no claims about full xAI API helper suite until separately verified

Required acceptance test:

```text
pi --model pi-grok-build/grok-build -p "Respond exactly PI_GROK_OK"
```

Must visibly output:

```text
PI_GROK_OK
```

And bad model must visibly output an error, not empty success.

### Option B: rebuild clean

Archive the current provider implementation and write a tiny one from scratch:
- detect `grok` via PATH only
- `grok models`
- pick `grok-build`
- spawn `grok -p ... --output-format streaming-json --no-subagents`
- parse only `thought/text/end/error`
- emit Pi events
- add one integration smoke script

This is probably cleaner long-term, because the current repo has too much “surface area before truth.”

## Recommendation

Do **Option A**, but brutally reduce the definition of done.

No more “extension passes tests.” The only meaningful definition is:

1. `grok models` drives Pi’s model list.
2. `pi-grok-build/grok-build` is selectable.
3. `pi -p` with that model visibly returns text.
4. invalid CLI/model/auth failures visibly surface as errors.
5. CI publishes only deterministic tests.
6. manual `test:grok` proves real local CLI integration.
7. one explicit smoke command proves Pi runtime integration.

Until #3 passes, it’s not shipped.
