import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Forecast } from '../types'

const forecast = atom({ plugin: 'token-face', key: 'forecast' } as const, null)

const TURNS = 12
const BARS = '▁▂▃▄▅▆▇█'

// Nothing here moves: the face is a still picture, redrawn only when a turn
// changes the reading. The size it is drawn at, in CSS pixels:
const REST = 48

// One face, five moods: the fuller the context window, the more it has seen.
// Each mood is the same head redrawn: colder skin, darker room, emptier eyes.
type Mood = {
  from: number
  caption: string
  color?: string
  text: [string, string]
  room: string
  skin: string
  edge: string
  eyes: string
  mouth: string
}

const FRESH: Mood = {
  from: 0,
  caption: 'Fresh context, no thoughts',
  color: 'green',
  text: ['(◕‿◕)', '(◠‿◠)'],
  room: '#2e7dd1',
  skin: '#ffd27d',
  edge: '#f0b04a',
  eyes: '<path d="M18 31 q5 -7 10 0 M36 31 q5 -7 10 0" fill="none" stroke="#3a2a1a" stroke-width="2.4" stroke-linecap="round"/>',
  mouth:
    '<path d="M20 42 q12 13 24 0 z" fill="#fff" stroke="#6b3f1d" stroke-width="1.6" stroke-linejoin="round"/>',
}

const MOODS: Mood[] = [
  {
    from: 90,
    caption: 'COMPACT. NOW.',
    color: 'red',
    text: ['(◉_◉)', '(●_●)'],
    room: '#000000',
    skin: '#e6e6e6',
    edge: '#3a3a3a',
    eyes: `<ellipse cx="23" cy="30" rx="7.5" ry="9" fill="#000"/><ellipse cx="41" cy="30" rx="7.5" ry="9" fill="#000"/><circle cx="23" cy="31" r="0.9" fill="#fff"></circle><circle cx="41" cy="31" r="0.9" fill="#fff"></circle>`,
    mouth: '<ellipse cx="32" cy="49" rx="4.5" ry="7.5" fill="#000"/>',
  },
  {
    from: 75,
    caption: 'It remembers too much',
    color: 'magenta',
    text: ['(⊙_⊙)', '(⊙﹏⊙)'],
    room: '#161616',
    skin: '#9a9a9a',
    edge: '#262626',
    eyes: '<ellipse cx="23" cy="30" rx="6.5" ry="7" fill="#111"/><ellipse cx="41" cy="30" rx="6.5" ry="7" fill="#111"/><circle cx="23" cy="31" r="1.2" fill="#ddd"/><circle cx="41" cy="31" r="1.2" fill="#ddd"/>',
    mouth: '<path d="M24 48 q8 -4 16 0" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>',
  },
  {
    from: 50,
    caption: 'Getting crowded in here',
    color: '#ff9f43',
    text: ['(•_•)', '(•_•;)'],
    room: '#4b4f55',
    skin: '#cdb89a',
    edge: '#8f7f66',
    eyes: '<ellipse cx="23" cy="30" rx="5" ry="6" fill="#fff"/><ellipse cx="41" cy="30" rx="5" ry="6" fill="#fff"/><circle cx="23" cy="30" r="1.6" fill="#222"/><circle cx="41" cy="30" r="1.6" fill="#222"/><path d="M17 21 h11 M36 21 h11" stroke="#5a4a36" stroke-width="2" stroke-linecap="round"/>',
    mouth: '<path d="M25 46 h14" stroke="#5a4a36" stroke-width="2" stroke-linecap="round"/>',
  },
  {
    from: 25,
    caption: 'Still fine',
    color: 'yellow',
    text: ['(•‿•)', '(-‿•)'],
    room: '#4a6fa5',
    skin: '#f2c27a',
    edge: '#d39a4e',
    eyes: `<ellipse cx="23" cy="30" rx="4" ry="5" fill="#fff"></ellipse><ellipse cx="41" cy="30" rx="4" ry="5" fill="#fff"></ellipse><circle cx="23.5" cy="30.5" r="2.2" fill="#3a2a1a"/><circle cx="41.5" cy="30.5" r="2.2" fill="#3a2a1a"/>`,
    mouth: '<path d="M24 45 q8 5 16 0" fill="none" stroke="#6b3f1d" stroke-width="2" stroke-linecap="round"/>',
  },
  FRESH,
]

const portrait = (mood: Mood): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
  `<defs><radialGradient id="skin" cx="50%" cy="42%" r="62%"><stop offset="0.45" stop-color="${mood.skin}"/><stop offset="1" stop-color="${mood.edge}"/></radialGradient></defs>` +
  `<rect width="64" height="64" rx="10" fill="${mood.room}"/>` +
  `<g>` +
  `<ellipse cx="32" cy="34" rx="21" ry="24" fill="url(#skin)"/>${mood.eyes}${mood.mouth}` +
  `</g></svg>`

// Your own pictures: faces/1 (freshest) to faces/4 (fullest), in any of these
// formats. A stage without a picture keeps its drawn face.
const KINDS = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
// An Svg's markup is capped at 131072 characters, the picture's base64 included.
const PICTURE_LIMIT = 120_000

// Read from disk at every draw, never kept: a picture replaced in the folder
// shows at the next turn, and the band only redraws when a turn moves it.
async function picture($: EngineInterface, stage: number): Promise<string | null> {
  for (const [extension, type] of Object.entries(KINDS)) {
    try {
      const { base64 } = await $.fs.read(`${$.plugin.root}/faces/${stage}.${extension}`, { as: 'bytes' })

      if (base64.length <= PICTURE_LIMIT) {
        return `data:${type};base64,${base64}`
      }
    } catch {
      // No picture in this format: try the next.
    }
  }

  return null
}

// The picture takes the drawn head's place.
const framed = (mood: Mood, href: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" width="64" height="64">` +
  `<defs><clipPath id="frame"><rect width="64" height="64" rx="10"/></clipPath></defs>` +
  `<g clip-path="url(#frame)"><rect width="64" height="64" fill="${mood.room}"/>` +
  `<g>` +
  `<image href="${href}" xlink:href="${href}" width="64" height="64" preserveAspectRatio="xMidYMid slice"/>` +
  `</g></g></svg>`

const short = (n: number): string => {
  const [value, unit] = n >= 1_000_000 ? [n / 1_000_000, 'M'] : n >= 1000 ? [n / 1000, 'k'] : [n, '']

  return `${value.toFixed(1).replace(/\.0$/, '')}${unit}`
}

// One bar per turn, each in the colour of the mood that turn was in, so a
// compaction reads as a run of one colour giving way to another.
const chart = (readings: number[], window: number): { bar: string; color?: string }[] =>
  readings.slice(-TURNS).map(tokens => {
    const percent = Math.round((tokens / window) * 100)

    return {
      bar: BARS[Math.min(BARS.length - 1, Math.floor((tokens / window) * BARS.length))] ?? ' ',
      color: (MOODS.find(m => percent >= m.from) ?? FRESH).color,
    }
  })

function record($: EngineInterface, window: number, tokens: number) {
  return update($, forecast, (now): Forecast => ({
    window,
    // One more than the chart draws, so the oldest bar still has a delta.
    readings: [...(now?.readings ?? []), tokens].slice(-(TURNS + 1)),
  }))
}

export const register: Register = on => {
  // A first reading, so the band is up before the first turn of a resumed
  // session; a reload fires this again and must not add a turn.
  on('session.start', async ($, e, next) => {
    const { context } = await $.session.usage()

    if (context.tokens !== undefined && (await read($, forecast)) === null) {
      await record($, context.window, context.tokens)
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context') && e.context.tokens !== undefined) {
      await record($, e.context.window, e.context.tokens)
    }

    return next(e)
  })

  // A compaction empties the window between turns, and no measurement follows
  // until the next response: take the drop from the compaction itself.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    const isMain = e.agentId === undefined && e.trigger !== 'precompute'
    const now = await read($, forecast)

    if (isMain && now !== null && result.messages !== undefined && result.tokensAfter !== undefined) {
      await record($, now.window, result.tokensAfter)
    }

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, forecast)

    if (e.props.hasSurvey) {
      return next(e)
    }

    if (now === null) {
      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box>
          <Text dimColor>(◕‿◕) token-face · waiting for the first reading</Text>
        </Box>
      )
    }

    const tokens = now.readings[now.readings.length - 1] ?? 0
    const before = now.readings[now.readings.length - 2]
    const percent = Math.round((tokens / now.window) * 100)
    const mood = MOODS.find(m => percent >= m.from) ?? FRESH
    const added = before === undefined ? null : tokens - before
    const bars = chart(now.readings, now.window)
    const figures = `${percent}% · ${short(tokens)} / ${short(now.window)}`
    const delta = added === null ? '' : `${added < 0 ? '▼ −' : '▲ +'}${short(Math.abs(added))} last turn`

    if (e.surface === 'desktop') {
      const { Box, Svg, Text } = $.ui.resolve(e)
      // Four pictures for five moods, fullest mood first: the two freshest
      // moods (under 50%) share faces/1.
      const stage = MOODS.indexOf(mood)
      const href = await picture($, [4, 3, 2, 1, 1][stage] ?? 1)

      return (
        <Box alignItems="center">
          <Box>
            <Svg
              source={href === null ? portrait(mood) : framed(mood, href)}
              alt={`${mood.text[0]} ${mood.caption}`}
              width={REST}
              height={REST}
            />
          </Box>
          <Text color={mood.color} bold>
            {'  '}
            {mood.caption}
          </Text>
          <Text>
            {'  '}
            {figures}
            {'  '}
          </Text>
          {bars.map(({ bar, color }, turn) => (
            <Text color={color}>{turn === 0 ? bar : ` ${bar}`}</Text>
          ))}
          <Text dimColor>
            {'  '}
            {delta}
          </Text>
        </Box>
      )
    }

    // Everywhere else the face is text.

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text color={mood.color} bold inverse={percent >= 90}>
          {mood.text[0]}
        </Text>
        <Text color={mood.color} bold>
          {' '}
          {mood.caption}
        </Text>
        <Text>
          {'  '}
          {figures}
          {'  '}
        </Text>
        {bars.map(({ bar, color }, turn) => (
          <Text color={color}>{turn === 0 ? bar : ` ${bar}`}</Text>
        ))}
        <Text dimColor>
          {'  '}
          {delta}
        </Text>
      </Box>
    )
  })
}
