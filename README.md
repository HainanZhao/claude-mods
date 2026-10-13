# Clawd Radio

A one-row radio above Claude Code's prompt. Click a station to play it right in
the terminal: Claude FM (the stream `/radio` opens in a browser) and 27 others.

```
▄▄▄  Claude FM  Lofi Girl  Synthwave  Groove Salad  Fluid  ›            🦀
```

Click the 🦀 to bring out Clawd, Claude Code's pixel crab, which walks while
Claude works. Click Clawd for a little surprise.

## Install

Requires Claude Code 2.1.296 or newer, plus `ffplay` and `yt-dlp`:

```sh
brew install ffmpeg yt-dlp
claude plugin marketplace add https://github.com/HainanZhao/claude-mods
claude plugin install clawd-radio@claude-mods
```

Restart Claude Code. To update later:

```sh
claude plugin marketplace update claude-mods
claude plugin update clawd-radio@claude-mods
```

To remove it: `claude plugin uninstall clawd-radio@claude-mods`.

## Use

| Click | To |
| --- | --- |
| A station | Play it; click it again to stop. |
| `▄▄▄` | Play or stop the selected station. Gray when silent, orange while playing. |
| `‹` `›` | Scroll the stations when they don't all fit. |
| 🦀 | Show or hide Clawd. |

Your station and whether Clawd is shown are remembered between sessions.

## Develop

```sh
claude --plugin-dir ./mods/clawd-radio   # try local changes
npm test
npm run validate
```

MIT licensed.
