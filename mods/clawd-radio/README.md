# Clawd Radio

A native Claude Code mod: a one-row radio above the prompt. Click a station to play
Claude FM or one of 27 other streams in the terminal (needs `ffplay`, plus `yt-dlp`
for the YouTube streams). The 🦀 at the row's end brings out Clawd, Claude Code's
pixel crab, which walks while Claude works; click it for a whip swing and a crack,
then a four-second sprint, or a jump when idle.

Requires Claude Code 2.1.296 or newer; tested on 2.1.296.

```sh
claude --plugin-dir /path/to/claude-mods/mods/clawd-radio
```

See the [project README](../../README.md) for installation, controls, and details.

From the marketplace directory, install it for future sessions:

```sh
claude plugin marketplace add .
claude plugin install clawd-radio@claude-mods --scope user
```
Shown, Clawd takes a four-row pixel-art lane above the radio row. The audio
is local and original. Sound availability depends on the host surface/player.
The animation keeps working if audio cannot play.

Run this mod's native tests with `claude plugin test /path/to/clawd-radio`.

MIT licensed; see [LICENSE](LICENSE).
