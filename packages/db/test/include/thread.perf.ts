import { wait } from '../../src/utils/index.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'
import { italy } from '../shared/examples.js'
import { BasedDb } from '../../src/index.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))
  // t.after(() => t.backup(db))

  await db.setSchema({
    locales: { en: true, de: true },
    types: {
      user: {
        props: {
          name: 'string',
          nr: 'uint32',
          body: 'text',
        },
      },
    },
  })

  for (let i = 0; i < 10000; i++) {
    db.create('user', {
      nr: i,
      name: 'Mr poop',
      body: {
        de: '🇮🇹🇮🇹🇮🇹🇮🇹🇮🇹🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹🤪🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹ewpofjwoif jweofhjweoifhweoifhweoihfoiwehfoiwehfoeiwhfoiewhfoiwehfoweihf eowifhowi efhwoefhweo ifhoeiw hoiewhfoiew foi oeiwfh ewoifhwe oioiweh ',
        en: italy,
      },
    })
    // if (i % 100) {
    // console.log('DRAIN!')
    // await db.drain()
    // }
  }

  console.log('start query')

  await db.drain()

  await db
    .query('user')
    .locale('de')
    .include('name', 'body', { end: 10 })
    .range(0, 1)
    .get()
    .inspect()

  // await db.query('user').include('name', 'body').range(0, 1).get().inspect()

  await perf(
    async () => {
      const q: any[] = []
      for (let i = 0; i < 1; i++) {
        q.push(
          db
            .query('user')
            .include('name', 'body')
            // .include('name', 'body', { end: 2 })
            .range(0, 1e6 + i)
            .get(),
          // .inspect(),
          // .inspect(),
        )
      }
      await Promise.all(q)
    },
    'Nodes',
    { repeat: 10 },
  )

  console.log('done')

  // await wait(100)
})
