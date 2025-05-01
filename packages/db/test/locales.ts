import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { langCodesMap, Schema } from '@based/schema'

await test('locales', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const locales: Schema['locales'] = {}
  const langs = [...langCodesMap.keys()].filter((val) => val !== 'none')
  for (const key of langs) {
    locales[key] = {}
  }

  await db.setSchema({
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

    db.create('thing', payload)
  }

  await db.drain()

  const things = await db.query('thing').get().toObject()

  for (const thing of things) {
    const payload: any = {
      string: null,
      text: {},
    }

    for (const key of langs) {
      payload.text[key] = null
    }

    db.update('thing', thing.id, payload)
  }

  await db.drain()

  const updatedThings = await db.query('thing').get().toObject()

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
