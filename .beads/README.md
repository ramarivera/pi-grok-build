# Beads tracking for pi-grok-build

This directory tracks the reality-grounded rebuild of `pi-grok-build`.

## Session protocol

At the start of each goal continuation session:

1. Run `bd onboard` if the shell is healthy.
2. Run `bd ready` / inspect `.beads/issues.jsonl`.
3. Pick one or two ready beads only.
4. Do the work with real verification.
5. Close a bead only when its acceptance criteria are met with evidence.
6. Commit when closing a bead.

If shell execution is poisoned, read `.beads/issues.jsonl` directly and report the blocker instead of pretending `bd` commands ran.

## Goal summary

Build a Pi extension that uses the local `grok` CLI on PATH as a real Grok Build inference provider across Pi-supported modes, with JSONL and ACP integration modes, real tests, Biome, Effect TS where appropriate, idiomatic Pi error/logging integration, reference research against dpcode/OpenCode, and image/video generation tools if they can be grounded in real CLI/API behavior.
