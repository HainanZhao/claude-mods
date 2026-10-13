# Donkey Whip

Approved in conversation: native Claude Code mod, a donkey that walks across a
strip above the prompt, turns at each edge, and sprints when its whip button is
clicked. The user also requested sounds on whip clicks.

## Behavior

- Walk at 5 character columns per second in an 80-column reference strip;
  sprint at 15 for four seconds. Project the position to each surface's width
  without changing state in a render hook.
- Every click refreshes the burst, briefly draws a whip and dust, and plays a
  bundled original whip-crack WAV through `$.audio.play`.
- Pause freezes movement and cancels redraw timers; resume restarts them.
- Mute stops current playback and suppresses subsequent sounds. Failed audio
  playback leaves the animation working and shows a quiet availability hint.
- No prompt submission, model calls, interrupts, subprocesses, or networking.

## Native integration

Ship `mods/donkey-whip` as a plugin with `hooks/hooks.json` and an ES module.
Use `session.start`, `session.end`, `ui.render` for `AbovePrompt`, and the host's
clock, UI, and audio APIs. Render a colored cell Raster on terminals and SVG on
remote surfaces. Keep the band within its available height, hide during surveys,
and compose the preceding band's result. Width changes must never leave the
donkey outside its lane. Headless sessions must not start animations.

## Implementation boundaries

- Pure motion module: elapsed-time movement, reflected edges, boost deadlines.
- Pure art module: hand-drawn donkey frames, whip, dust, Raster/SVG conversion.
- Hook module: session state, timers, drawing, controls, and audio lifecycle.
- Original sound asset and deterministic generator script.
- Local marketplace, README, and zero-dependency Node tests plus native mod tests.

## Verification

Node tests verify elapsed-time motion including boost expiration and resizing.
Claude Code's own test harness verifies mounting and clicks on terminal and
desktop, paused state, mute, rejected audio, timer cleanup, and survey fallback.
Validate the packaged plugin with the installed CLI. Native tests validate the
element descriptions and handlers, not the terminal's painted pixels or actual
speaker output; report those limits explicitly.

## User refinements (v1.1.0)

The user reported the donkey was invisible, too large, and unattractive. A live
layout probe reproduced `next(e)` returning `{type: "engine", ref: ...}`; the
height estimator incorrectly classified it as infinite. It now treats the
non-survey core placeholder as empty. The final character is the actual 🫏
emoji in a one-row lane, with phased crack marks and a direction-aware dust
trail; the rejected pixel sprite and green ground marks were removed.

The donkey walks on session start/restart, rests on main-task completion or
cancellation, and resumes on the next main task. Manual pause persists through
task starts; clicking Whip resumes it. An idle whip sprints for four seconds then
returns to rest. Session exit cancels frame timers and audio.
