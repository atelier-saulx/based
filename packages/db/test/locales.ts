import assert from 'node:assert'
import { BasedDb } from '../src/index.ts'
import native from '../src/native.ts'
import test from './shared/test.ts'
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

await test('locales sanity check', async (t) => {
  // prettier-ignore
  const missingOnDarwin = new Set([ 'aa', 'ab', 'ak', 'sq', 'an', 'as', 'ae', 'ay', 'az', 'bn', 'bi', 'bs', 'br', 'my', 'km', 'ce', 'cv', 'kw', 'co', 'dv', 'dz', 'fo', 'ff', 'gd', 'gl', 'kl', 'gu', 'ht', 'ha', 'hi', 'ig', 'id', 'ia', 'iu', 'ik', 'ga', 'kn', 'ks', 'rw', 'ku', 'ky', 'lo', 'la', 'lv', 'lb', 'li', 'ln', 'mk', 'mg', 'ms', 'ml', 'mt', 'gv', 'mi', 'mn', 'ne', 'se', 'no', 'nb', 'nn', 'oc', 'or', 'om', 'os', 'pa', 'ps', 'fa', 'qu', 'rm', 'sm', 'sa', 'sc', 'sr', 'sd', 'si', 'so', 'st', 'nr', 'sw', 'ss', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'bo', 'ti', 'to', 'ts', 'tn', 'tk', 'ug', 'ur', 'uz', 've', 'vi', 'wa', 'cy', 'fy', 'wo', 'xh', 'yi', 'yo', 'zu', 'ka', 'cnr' ])
  const selvaLangs = new Set(native.selvaLangAll().split('\n'))

  langCodesMap.forEach((value, key) => {
    if (value === 0) return
    if (process.platform === 'darwin' && !missingOnDarwin.has(key)) {
      assert(selvaLangs.has(key), `Lang '${key}' is found in selva`)
    }
  })
})
