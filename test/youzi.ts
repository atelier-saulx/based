import test from './shared/test.js'
import { perf } from './shared/assert.js'
import { italy } from './shared/examples.js'
import { BasedDb } from '../src/index.js'

await test('youzi', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))
  // t.after(() => t.backup(db))

  await db.setSchema({
    // locales: {
    //   en: true,
    //   de: { fallback: ['en'] },
    //   fr: { fallback: ['en'] },
    //   nl: { fallback: ['fr', 'en', 'de'] },
    //   no: true,
    // },
    types: {
      user: {
        props: {
          // flap: { enum: ['⚡️', '🤪', '💩'] }, // default: '🤪'
          // derp: ['hello', 'bye'],
          // name: { type: 'string' }, // default: 'xxxx'
          nr: { type: 'uint32', default: 22 },
          // body: { type: 'text' }, // compression: 'none'
        },
      },
    },
  })

  await db.create('user', {
    nr: 67,
    // // nr: i + 67,
    // name: 'A',
    // flap: '⚡️',
    // body: {
    //   // nl: 'x',
    //   fr: 'B',
    //   de: '🇮🇹🇮🇹🇮🇹🇮🇹🇮🇹🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹🤪🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹ewpofjwoif jweofhjweoifhweoifhweoihfoiwehfoiwehfoeiwhfoiewhfoiwehfoweihf eowifhowi efhwoefhweo ifhoeiw hoiewhfoiew foi oeiwfh ewoifhwe oioiweh ',
    //   en: italy,
    // },
  })
})
