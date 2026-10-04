import { expect, test } from 'claude-code/testing'

const SUMMARY = [{ role: 'user' as const, text: 'summary', toolUses: [] }]
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false } as never } as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the face and figures draw on ${surface}`, async ($, on) => {
    on('session.measure', (_, e) => ({ changed: e.changed }))
    for (const tokens of [40_000, 134_400]) {
      await $.session.measure({
        context: { tokens, window: 200_000, percent: 0 },
        rateLimits: [],
        changed: ['context'],
      })
    }

    const ui = await $.ui.mount({ plugin: 'token-face', surface, ...BAND })
    const drawn = JSON.stringify(await ui.drawn())

    expect(drawn).toContain('Getting crowded in here')
    expect(drawn).toContain('134.4k')
    expect(drawn).toContain('200k')
    expect(drawn).toContain('94.4k')
    expect(drawn).toContain(surface === 'desktop' ? '<svg' : '(•_•)')
  })
}

test('past 90% the desktop face warns, and nothing animates', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { tokens: 190_000, window: 200_000, percent: 0 },
    rateLimits: [],
    changed: ['context'],
  })

  const ui = await $.ui.mount({ plugin: 'token-face', surface: 'desktop', ...BAND })
  const drawn = JSON.stringify(await ui.drawn())

  expect(drawn).toContain('COMPACT. NOW.')
  expect(drawn).not.toContain('animate')
})

test('a compaction calms the face at once', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.compact', () => ({ messages: SUMMARY, tokensBefore: 160_000, tokensAfter: 20_000 }))
  await $.session.measure({
    context: { tokens: 160_000, window: 200_000, percent: 0 },
    rateLimits: [],
    changed: ['context'],
  })
  await $.session.compact({ trigger: 'manual', messages: SUMMARY })

  const ui = await $.ui.mount({ plugin: 'token-face', surface: 'desktop', ...BAND })
  const drawn = JSON.stringify(await ui.drawn())

  expect(drawn).toContain('Fresh context')
  expect(drawn).toContain('20k')
  expect(drawn).toContain('140k')
})

test('a picture in faces/ takes the drawn face\'s place', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('fs.read', (_, e) =>
    e.path.replaceAll('\\', '/').endsWith('faces/1.png') ? { value: { base64: 'aGVsbG8=' } } : { deny: 'no such file' },
  )
  await $.session.measure({
    context: { tokens: 20_000, window: 200_000, percent: 0 },
    rateLimits: [],
    changed: ['context'],
  })

  const ui = await $.ui.mount({ plugin: 'token-face', surface: 'desktop', ...BAND })
  const drawn = JSON.stringify(await ui.drawn())

  expect(drawn).toContain('data:image/png;base64,aGVsbG8=')
  expect(drawn).toContain('Fresh context')
})

test('each bar keeps the colour of its own turn', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  for (const tokens of [170_000, 20_000]) {
    await $.session.measure({
      context: { tokens, window: 200_000, percent: 0 },
      rateLimits: [],
      changed: ['context'],
    })
  }

  const ui = await $.ui.mount({ plugin: 'token-face', surface: 'terminal', ...BAND })
  const drawn = JSON.stringify(await ui.drawn())

  // The 85% turn's bar stays magenta beside the fresh green one.
  expect(drawn).toContain('"color":"magenta"},"children":["▇"]')
  expect(drawn).toContain('"color":"green"},"children":[" ▁"]')
})
