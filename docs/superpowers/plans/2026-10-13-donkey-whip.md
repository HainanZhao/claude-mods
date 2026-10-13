# Donkey Whip Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline, task by task.

**Goal:** Build an installable native Claude Code donkey animation with a clickable, audible whip.

**Architecture:** Pure motion and artwork modules feed a native AbovePrompt hook.
The hook owns timers, controls, and bundled audio playback through host APIs.

**Tech Stack:** ES modules, Node built-in test runner, Claude Code mod testing kit, Python WAV generator.

**Spec:** `docs/superpowers/specs/2026-10-13-donkey-whip-design.md`

## Global Constraints

- Walk at 5 reference columns/sec, sprint at 15 for four seconds; each click refreshes.
- Use native UI, clock, and audio APIs; no prompts, interrupts, networking, or subprocesses.
- Headless sessions have no animation timers; paused sessions freeze movement.
- Original local sound, mute button, failure tolerant playback.
- Terminal Raster and remote SVG; respect available dimensions and surveys.

### Task 1: Motion and artwork

**Files:** `mods/donkey-whip/hooks/motion.mjs`, `art.mjs`, `tests/motion.test.mjs`.

**Interfaces:** `createMotion(now)`, `advanceMotion(state, now, lane)`,
`whipMotion(state, now, lane)`, `pauseMotion(state, now, lane)`,
`resumeMotion(state, now)` return immutable motion states. `scene(state, columns)`
returns pixel rows; `rasterScene(state, columns)` and `svgScene(state, columns)`
produce native element props.

- [x] Write failing Node tests with hand-calculated movement, edge reflection,
  four-second expiration, refreshed bursts, pause/resume, resize, and tiny lanes.
- [x] Run `node --test tests/motion.test.mjs`; confirm missing-feature failure.
- [x] Implement pure motion with time integration split at the boost deadline;
  reflected position must be in `[0, lane]` even across multiple edge crossings.
- [x] Implement one shared pixel scene, terminal half-block cells, remote SVG.
- [x] Run Node tests and inspect stationary/walking/sprinting art fixtures.

### Task 2: Native controls and sound

**Files:** plugin manifest, hook registration, WAV asset, generator,
`mods/donkey-whip/tests/register.test.ts`.

**Interfaces:** `register(on)` installs native session/render handlers;
Button keys are `whip`, `pause`, `mute`. Asset is `assets/whip-crack.wav`.

- [x] Write native failing tests that mount terminal/desktop, click whip,
  advance the mock clock, click pause/mute, and reject audio playback.
- [x] Run `claude plugin test mods/donkey-whip`; confirm missing-feature failures.
- [x] Generate a deterministic 0.35-second PCM WAV with a rising swish and crack.
- [x] Implement registration using `$.clock.every(100, ...)`,
  `$.ui.invalidate('ui.render')`, and `$.audio.play({asset}, {signal, gain})`.
- [x] Stop timers on pause/end and abort prior sounds before a new click.
- [x] Render a compact fallback if the band cannot fit the artwork; compose
  `next(e)` above our strip and return it unchanged during surveys.
- [x] Run native tests and `claude plugin validate --strict mods/donkey-whip`.

### Task 3: Packaging and review

**Files:** root marketplace manifest, `README.md`, `package.json`, `.gitignore`.

- [x] Document single-session launch, marketplace installation, controls,
  sound behavior, API version tested, and verification limits.
- [x] Run `npm test`, native mod tests, and strict plugin/marketplace validation.
- [x] Inspect final files for unwanted prompt/process/network calls and ensure
  all approved behaviors have test evidence; report real verification limits.

The workspace began empty with no Git repository, so work occurs in place;
there is no existing branch or unrelated work to isolate or commit.

## Verified outcome

27 tests pass (13 Node, 14 native); strict plugin and marketplace validation
pass. Native TypeScript tests type-check against the installed declarations.
Live terminal mouse click triggered the burst, and pause froze the animation.
The WAV played through macOS afplay. Desktop drawing was validated in the native
harness; no live desktop window or desktop speaker check was performed.

Review fixes include height budgeting for preceding bands and explicit/padded
Boxes, plus session-generation guards after asynchronous clock reads. Regression
tests reproduced these failures before their fixes. Follow-up review found no
remaining material issues in the fixes.
