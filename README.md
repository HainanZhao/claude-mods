# Claude Mods

Two small mods for Claude Code. Install either or both.

## Clawd Radio

A one-row radio above the prompt. Click a station to play it right in the
terminal: Claude FM (the stream `/radio` opens in a browser) and 37 others.

```
▄▄▄  ‹  Drone Zone  Deep Space  Top 100  PopTron  Indie Pop  Hip Hop  ›     12 / 38
```

| Click | To |
| --- | --- |
| A station | Play it; click it again to stop. |
| `▄▄▄` | Play or stop. Gray when silent, orange bars while playing. |
| `‹` `›` | Scroll the stations. |

Your station is remembered between sessions.

## Clawd

Clawd, Claude Code's pixel crab, walks above the prompt while Claude works and
rests between tasks. Click it for a little surprise. With Clawd Radio too, Clawd
sits above the radio row.

## Install

Requires Claude Code 2.1.296 or newer. The radio also needs `ffplay` and `yt-dlp`:

```sh
brew install ffmpeg yt-dlp
claude plugin marketplace add https://github.com/HainanZhao/claude-mods
claude plugin install clawd-radio@claude-mods
claude plugin install clawd@claude-mods
```

Restart Claude Code. To update later:

```sh
claude plugin marketplace update claude-mods
claude plugin update clawd-radio@claude-mods
claude plugin update clawd@claude-mods
```

To remove one: `claude plugin uninstall clawd@claude-mods` (or `clawd-radio`).

## Develop

```sh
claude --plugin-dir ./mods/clawd-radio --plugin-dir ./mods/clawd
npm test
npm run validate
```

MIT licensed.
