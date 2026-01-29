import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'
import { notEqual } from 'node:assert'
import { fastPrng } from '../../src/utils/fastPrng.js'

//const N_PROPS = 248
const N_PROPS = 127

const languages = [ 'de', 'en', 'fi', 'it', 'aa', 'ab', 'af', 'ak', 'sq', 'am', 'ar', 'an', 'hy', 'as', 'av', 'ae', 'ay', 'az', 'eu', 'be', 'bn', 'bi', 'bs', 'br', 'bg', 'my', 'ca', 'km', 'ce', 'zh', 'cv', 'kw', 'co', 'hr', 'cs', 'da', 'dv', 'nl', 'dz', 'et', 'fo', 'fr', 'ff', 'gd', 'gl', 'gsw', 'el', 'kl', 'gu', 'ht', 'ha', 'he', 'hi', 'hu', 'is', 'ig', 'id', 'ia', 'iu', 'ik', 'ga', 'it', 'ja', 'kn', 'ks', 'kk', 'rw', 'ko', 'ku', 'ky', 'lo', 'la', 'lv', 'lb', 'li', 'ln', 'lt', 'mk', 'mg', 'ms', 'ml', 'mt', 'gv', 'mi', 'ro', 'mn', 'ne', 'se', 'no', 'nb', 'nn', 'oc', 'or', 'om', 'os', 'pa', 'ps', 'fa', 'pl', 'pt', 'qu', 'rm', 'ru', 'sm', 'sa', 'sc', 'sr', 'sd', 'si', 'sk', 'sl', 'so', 'st', 'nr', 'es', 'sw', 'ss', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'bo', 'ti', 'to', 'ts', 'tn', 'tr', 'tk', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'wa', 'cy', 'fy', 'wo', 'xh', 'yi', 'yo', 'zu', 'ka', 'cnr', ] as const // prettier-ignore

const rng = fastPrng(100)
const randLoc = () => languages[rng(0, languages.length - 1)]

function makeMaxSchema() {
  const locs = {}

  for (const l of languages) {
    locs[l] = { fallback: [randLoc(), randLoc()] }
  }

  return locs
}

function makeTextProps(): { [index: string]: { type: 'text' } } {
  const textProps = {}

  const prop = { type: 'text' }
  for (let i = 0; i < N_PROPS; i++) {
    textProps[`t${i}`] = prop
  }

  return textProps
}

function setTextProps(): {
  [index: string]: { en: string; it: string; fi: string }
} {
  const s = {}
  const v = {}

  for (const l of languages) {
    s[l] = 'hello'
  }

  for (let i = 0; i < N_PROPS; i++) {
    v[`t${i}`] = s
  }

  return v
}

await test('Many text props', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: makeMaxSchema(),
    types: {
      dialog: {
        props: {
          ...makeTextProps(),
        },
      },
    },
  })

  await db.create('dialog', setTextProps())
  console.log(await db.query('dialog').include('*').get())
})
