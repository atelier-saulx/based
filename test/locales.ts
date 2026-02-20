import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { LangCode } from '../src/zigTsExports.js'

const langs = [...Object.keys(LangCode)].filter((val) => val !== 'none')
const locales = Object.fromEntries(langs.map((l: keyof typeof LangCode) => [l, {}]))

await test('locales', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await db.setSchema({
    locales,
    types: {
      thing: {
        text: 'text',
        string: 'string',
      },
    },
  })

  let i = 1000
  while (i--) {
    const payload: any = {
      string: 'xxx',
      text: {},
    }

    for (const key of langs) {
      payload.text[key] = key
    }

    client.create('thing', payload)
  }

  const things = await client.query('thing').get().toObject()

  for (const thing of things) {
    const payload: typeof thing = {
      string: null,
      text: Object.fromEntries(Object.keys(thing.text).map((l) => [l, null])),
    }

    client.update('thing', thing.id, payload)
  }

  await client.drain()

  const updatedThings = await client.query('thing').get().toObject()

  for (const thing of updatedThings) {
    if (thing.string !== '') {
      throw Error('string should be deleted')
    }
    for (const i in thing.text) {
      if (thing.text[i] !== '') {
        throw Error('text should be deleted')
      }
    }
  }
})
