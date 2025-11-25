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
    locales: {
      en: { required: true },
      de: { fallback: 'en' },
      fr: { fallback: 'en' },
      nl: { fallback: 'de' },
    },
    types: {
      user: {
        props: {
          name: 'string',
          nr: 'uint32',
          body: { type: 'text', compression: 'deflate' }, // compression: 'none'
        },
      },
    },
  })

  for (let i = 0; i < 1000; i++) {
    db.create('user', {
      nr: i,
      name: 'Mr poop',
      body: {
        de: '🇮🇹🇮🇹🇮🇹🇮🇹🇮🇹🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹🤪🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇮🇹ewpofjwoif jweofhjweoifhweoifhweoihfoiwehfoiwehfoeiwhfoiewhfoiwehfoweihf eowifhowi efhwoefhweo ifhoeiw hoiewhfoiew foi oeiwfh ewoifhwe oioiweh ',
        en: italy,
      },
    })
  }

  console.log('start query')

  await db.drain()

  console.log('drain done')

  await db
    .query('user')
    .locale('nl')
    .include('name', 'body')

    // .include('name', 'body.de', 'body.nl')
    .range(0, 1000)
    .get()
    .inspect()

  // await db.query('user').include('name', 'body').range(0, 1).get().inspect()

  await perf(
    async () => {
      const q: any[] = []
      for (let i = 0; i < 1000; i++) {
        q.push(
          db
            .query('user')
            .locale('de')
            .include('name', 'body')
            // .include('name', 'body', { end: 2 })
            .range(0, 1000 + i)
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

await test('default', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))
  //t.after(() => t.backup(db))

  await db.setSchema({
    locales: { en: true, de: true },
    types: {
      user: {
        props: {
          name: {
            type: 'string',
            default: 'dingdong'.repeat(100),
          },
          city: {
            type: 'string',
            maxBytes: 16,
            default: 'N/A',
          },
          bio: {
            type: 'string',
            maxBytes: 1024,
            default: 'habablababalba',
          },
          nr: { type: 'uint32', default: 95 },
          body: { type: 'text', default: { en: 'ding', de: 'dong' } }, // compression: 'none'
        },
      },
    },
  })

  for (let i = 0; i < 10; i++) {
    db.create('user', {})
  }

  console.log('start')
  await perf(
    async () => {
      await db.query('user').include('name', 'bio').get().inspect()
    },
    'Dun',
    { repeat: 1 },
  )
  console.log('done')
})
