# token-face

A Claude Code mod that puts a face above the prompt. The fuller your context
window gets, the worse the face looks.

```
(•_•) Crowded  61% · 610.1k / 1M  ▁ ▂ ▃ ▄ ▅  ▲ +6.4k last turn
```

## What it shows

- **A face and a caption** for how full the context window is:

  | Context used | Caption | Picture |
  |---|---|---|
  | under 25% | Fresh | <img src="faces/1.png" width="64" alt="Stage 1 picture"> |
  | 25–39% | Fine | <img src="faces/1.png" width="64" alt="Stage 1 picture"> |
  | 40–64% | Crowded | <img src="faces/2.png" width="64" alt="Stage 2 picture"> |
  | 65–89% | Too much | <img src="faces/3.png" width="64" alt="Stage 3 picture"> |
  | 90% and up | COMPACT. NOW. | <img src="faces/4.png" width="64" alt="Stage 4 picture"> |

- **The percentage and tokens used**, like `134.4k / 200k`.
- **A chart of the last 12 turns**, each bar in the colour of the stage that
  turn was in.
- **How much the last turn added**, or how much a compaction removed.

It updates after every turn, and straight after a compaction.

In the desktop app the face is a picture. In a terminal it is a text face
such as `(•_•)`.

## Install

```
/plugin marketplace add MohamedEmbarak/token-face
/plugin install token-face@token-face
```

The mod is built on Claude Code's function hooks. If nothing shows above the
prompt after installing, add this to the `env` block of
`~/.claude/settings.json` and restart Claude Code:

```json
"CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"
```

## Use your own pictures

The mod ships with four pictures, one per stage, in the plugin's `faces/`
folder. To use your own, replace them:

| File | Shown when context is |
|---|---|
| `1.png` | under 40% |
| `2.png` | 40–64% |
| `3.png` | 65–89% |
| `4.png` | 90% and up |

png, jpg, jpeg, gif or webp, each under about 85 KB (128×128 is plenty). A
stage without a picture keeps its drawn face. Only use pictures you made or
have the right to use.

## Develop

From this folder:

```
claude plugin validate .
claude plugin test .
```

## Licence

MIT
