import { setWalker, BasedSchema } from '../src/index.js'
import test from 'ava'
import { resultCollect } from './utils/index.js'

const schema: BasedSchema = {
  types: {
    thing: {
      prefix: 'ti',
      fields: {
        something: { type: 'string', format: 'strongPassword' },
      },
    },
    bla: {
      prefix: 'bl',
      fields: {
        text: {
          type: 'text',
          pattern: '[^xz]{1,10}',
        },
      },
    },
  },
  $defs: {},
  language: 'en',
  translations: ['de', 'nl', 'ro', 'za', 'ae'],
  languageFallbacks: {
    en: ['en'],
    de: ['en'],
    fr: ['aa'],
  },
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
    ti: 'thing',
  },
}

let r

test('throw error no language', async (t) => {
  let r = await setWalker(schema, {
    $id: 'bl120',
    text: { $value: 'x' },
  })
  t.true(r.errors.length > 0)
})

test('simple case', async (t) => {
  let r = await setWalker(schema, {
    $id: 'bl120',
    text: { en: 'flap' },
  })
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'en'], value: 'flap' },
    { path: ['text'], value: { en: 'flap' } },
  ])
})

test('simple case $value', async (t) => {
  let r = await setWalker(schema, {
    $id: 'bl120',
    text: { en: { $value: 'flap' } },
  })
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'en'], value: 'flap' },
    { path: ['text'], value: { en: { $value: 'flap' } } },
  ])
})

test('simple case $language', async (t) => {
  let r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'en',
    text: 'flap',
  })
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'en'], value: 'flap' },
    { path: ['text'], value: { en: 'flap' } },
  ])
})

test('simple case with value', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $value: 'flap' },
  })
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'za'], value: 'flap' },
    { path: ['text'], value: { $value: 'flap' } },
  ])
})

test('simple case $value /w obj', async (t) => {
  let r = await setWalker(schema, {
    $id: 'bl120',
    text: { $value: { en: 'flap' } },
  })
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'en'], value: 'flap' },
    { path: ['text'], value: { $value: { en: 'flap' } } },
  ])
})

test('text default', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $default: 'sdsdds' },
  })
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'za'], value: { $default: 'sdsdds' } },
    { path: ['text'], value: { $default: 'sdsdds' } },
  ])
})

test('default and lang:default', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $default: 'sdsdds', en: { $default: 'flapflap' } },
  })

  t.deepEqual(resultCollect(r), [
    { path: ['text', 'za'], value: { $default: 'sdsdds' } },
    { path: ['text', 'en'], value: { $default: 'flapflap' } },
    {
      path: ['text'],
      value: { $default: 'sdsdds', en: { $default: 'flapflap' } },
    },
  ])
})

test('default: lang, lang', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $default: { de: 'dsnfds' }, en: { $default: 'flapflap' } },
  })
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'de'], value: { $default: 'dsnfds' } },
    { path: ['text', 'en'], value: { $default: 'flapflap' } },
    {
      path: ['text'],
      value: { $default: { de: 'dsnfds' }, en: { $default: 'flapflap' } },
    },
  ])
})

test('defaullt:lang, lang, lang:default', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: {
      $default: { de: 'dsnfds' },
      nl: 'flapperonus',
      en: { $default: 'flapflap' },
    },
  })
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'de'], value: { $default: 'dsnfds' } },
    { path: ['text', 'nl'], value: 'flapperonus' },
    { path: ['text', 'en'], value: { $default: 'flapflap' } },
    {
      path: ['text'],
      value: {
        $default: { de: 'dsnfds' },
        nl: 'flapperonus',
        en: { $default: 'flapflap' },
      },
    },
  ])
})

test('default:lang, lang, lang:value, lang:default', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: {
      $default: { de: 'dsnfds' },
      nl: 'flapperonus',
      ro: { $value: 'durp' },
      en: { $default: 'flapflap' },
    },
  })

  t.deepEqual(resultCollect(r), [
    { path: ['text', 'de'], value: { $default: 'dsnfds' } },
    { path: ['text', 'nl'], value: 'flapperonus' },
    { path: ['text', 'ro'], value: 'durp' },
    { path: ['text', 'en'], value: { $default: 'flapflap' } },
    {
      path: ['text'],
      value: {
        $default: { de: 'dsnfds' },
        nl: 'flapperonus',
        ro: { $value: 'durp' },
        en: { $default: 'flapflap' },
      },
    },
  ])
})

test('value:lang, lang, default:lang, lang:value, lang:default', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: {
      $value: 'durp',
      nl: 'flapperonus',
      $default: {
        ae: 'habibi',
      },
      ro: { $value: 'durp' },
      en: { $default: 'flapflap' },
    },
  })

  t.deepEqual(resultCollect(r), [
    { path: ['text', 'za'], value: 'durp' },
    { path: ['text', 'nl'], value: 'flapperonus' },
    { path: ['text', 'ae'], value: { $default: 'habibi' } },
    { path: ['text', 'ro'], value: 'durp' },
    { path: ['text', 'en'], value: { $default: 'flapflap' } },
    {
      path: ['text'],
      value: {
        $value: 'durp',
        nl: 'flapperonus',
        $default: {
          ae: 'habibi',
        },
        ro: { $value: 'durp' },
        en: { $default: 'flapflap' },
      },
    },
  ])
})

test('value: wrong pattern, lang, default:lang, lang:value, lang:default', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: {
      $value: 'xz',
      nl: 'flapperonus',
      $default: {
        ae: 'habibi',
      },
      ro: { $value: 'durp' },
      en: { $default: 'xzxz' },
    },
  })
  t.true(r.errors.length > 0)
})

test('text delete', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    text: {
      $delete: true,
    },
  })
  t.deepEqual(resultCollect(r), [{ path: ['text'], value: { $delete: true } }])
})

test('text delete single language', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    text: {
      en: {
        $delete: true,
      },
    },
  })
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'en'], value: { $delete: true } },
    {
      path: ['text'],
      value: {
        en: {
          $delete: true,
        },
      },
    },
  ])
})

test('just delete', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $delete: true,
  })
  t.true(r.errors.length === 1)
})

test('$default in collected path', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    text: {
      en: {
        $default: 'title',
      },
    },
  })
  t.is(r.errors.length, 0)
  t.deepEqual(resultCollect(r), [
    { path: ['text', 'en'], value: { $default: 'title' } },
    {
      path: ['text'],
      value: {
        en: {
          $default: 'title',
        },
      },
    },
  ])
})

test('$default in collected path + $merge:false', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    text: {
      $merge: false,
      en: {
        $default: 'title',
      },
    },
  })
  t.is(r.errors.length, 0)
  t.deepEqual(resultCollect(r), [
    { path: ['text'], value: { $delete: true } },

    { path: ['text', 'en'], value: { $default: 'title' } },
    {
      path: ['text'],
      value: {
        $merge: false,
        en: {
          $default: 'title',
        },
      },
    },
  ])
})
