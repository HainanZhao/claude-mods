# Clawd Radio

A one-row radio above Claude Code's prompt plays Claude FM (the lo-fi stream
`/radio` opens in a browser) and 27 other stations right in the terminal: click
one to listen.

Click the 🦀 at the row's end to bring out Clawd, Claude Code's orange pixel
crab, which walks above the radio while Claude works and rests between tasks. Click Clawd to whip it: a lash swings onto its claw,
a sharp crack plays, and it sprints off in a cloud of dust while Claude works,
or jumps in place when no task is running.

## Try it

Requires **Claude Code 2.1.296 or newer**; tested on 2.1.296. From this directory:

```sh
claude --plugin-dir ./mods/clawd-radio
```

Clawd appears just above the input prompt. While a task runs, a click
triggers a four-second burst at three times its walking speed, and another click
refreshes the burst. Between tasks, a click makes it jump in place. Clawd turns at either end of the strip; its dust follows behind it.

## Install for future sessions

From this directory:

```sh
claude plugin marketplace add .
claude plugin install clawd-radio@claude-mods --scope user
```

Restart Claude Code after installing. To remove it:

```sh
claude plugin uninstall clawd-radio@claude-mods --scope user
```

If you installed an earlier version, refresh it and restart Claude Code:

```sh
claude plugin update clawd-radio@claude-mods
```

## Controls

| Control | Effect |
| --- | --- |
| **Clawd** | Whip swing and crack, then a four-second sprint (task running) or a jump (idle). |
| **A station** | Play it; click the one playing to stop it. The selected one is bright, the rest dim. |
| **The bars** | Play or stop the selected station: a gray `▄▄▄` block when off, bouncing orange while playing, ⚠️ when it can't play. |
| **‹ / ›** | Scroll the stations when they don't all fit; a playing radio retunes. |
| **🦀** | Show or hide Clawd; hidden at first, and remembered like the station. |

Stations, roughly by mood: Claude FM, Lofi Girl and Lofi Girl synthwave (YouTube
live streams); Groove Salad, Fluid, Beat Blender, Secret Agent, Lush, Drone Zone
and Deep Space; Top 100, PopTron, Indie Pop, Hip Hop and Dance; Radio Paradise,
KEXP, 80s and 70s; Jazz, Nu Jazz, Electro Swing and Classical; Reggae,
Americana, Metal, DEF CON and NTS. Most are SomaFM channels; the rest are
ilovemusic.de, Radio Paradise, KEXP, SRG SSR (Swiss Jazz, Swiss Classic),
Jazz Radio and NTS. The last station chosen is remembered for the next session.

In the terminal, clicking works where mouse input is supported; otherwise focus
the band with **Ctrl+X, Tab** and press Enter on a radio control (whipping Clawd
in the terminal needs a click). A band too short for Clawd keeps just the radio
row.

The whip crack plays through Claude Code's native audio API. Rapid clicks
retrigger at most eight sounds per second. If playback is unavailable, the
animation keeps working.

The radio needs `ffplay` on your PATH, plus `yt-dlp` for the YouTube stations
(`brew install yt-dlp ffmpeg`). Play resolves a YouTube live stream with
`yt-dlp`, or uses SomaFM's MP3 stream directly, and plays it windowless with
`ffplay -nodisp`; Stop, or ending the session, kills the player. If either tool
is missing the radio row says so.

## How it works

This is a native **Mod**, packaged as a Claude Code plugin with a function hooks
module. It draws into `AbovePrompt` with `$.ui.resolve`, refreshes at 10 FPS using
`$.clock.every`, plays `assets/whip-crack.wav` with `$.audio.play`, and runs the
radio with `$.process.run` and `$.process.spawn`.

Clawd is drawn exactly as Claude Code's banner draws it, with quadrant blocks (`▐▛█▜▌`, four
pixels per cell) in native Text elements, on terminal and desktop. The
band takes five rows: Clawd's full-width lane (four rows, one of them headroom for
the jump) over the radio row. In the terminal a click anywhere on the lane whips
Clawd, with no hover or focus highlight, and typing still goes to the prompt; on
desktop Clawd itself is the button.
Stacking keeps Clawd's full walk even in narrow tab-style panes; the radio row
shows as many stations as fit around the selected one. A band too short for the art keeps just the radio row. Surveys retain their own band; other mods' content
is composed above this one. The live host's opaque default `engine` band is
handled explicitly, so it does not accidentally hide Clawd.

Walking speed is five columns per second in an 80-column reference strip, scaled
to fit each surface. Boosts last four seconds of wall-clock time, including time
paused. It rests when a session starts or restarts and when Claude finishes or
cancels a task, and walks only while a task is running. A whip while idle
makes it jump in place and stay at rest. Session exit cancels timers,
audio, and the radio. Headless sessions do not start the animation.

The whip changes the animation only. It makes no model calls or prompt changes.

## Develop and verify

Node 22+, the Claude Code CLI, and Python 3 to regenerate the sound. No npm
dependencies or build step are needed.

```sh
npm test
npm run validate
npm run sound:generate
```

- `tests/`: movement, burst timing, reflection, resizing, art clipping and effect phases,
  delayed clock responses at session exit, and audio cancellation.
- `mods/clawd-radio/tests/`: native UI, clicks, audio request, audio failure, radio play/stop, station cycling,
  compact layout, survey composition, headless sessions, and timer shutdown.

The native harness validates the actual mod handlers and element trees on
terminal and desktop surfaces. It does not paint a desktop window or test its
speakers. A live terminal smoke test on macOS also verified mouse-triggered
sprinting and pause. The local WAV was checked and played with macOS `afplay`.

Claude Code generates `.claude-plugin/types/` when the mod loads, for editor
types; these machine-generated declarations are ignored by Git.

## Inspiration

Inspired by [OpenWhip](https://github.com/GitFrog1111/OpenWhip). The artwork, sound,
and implementation here are original. Native packaging follows
[Anthropic's mod examples](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods).

MIT licensed.
