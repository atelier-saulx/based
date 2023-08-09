import { setWalker, BasedSchema } from '../src'
import test from 'ava'
import { ParseError } from '../src/error'
import { resultCollect } from './utils'

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
  languages: ['en', 'de', 'nl', 'ro', 'za', 'ae'],
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
  t.deepEqual(resultCollect(r), [{ path: ['text'], value: { en: 'flap' } }])
})

test('simple case with value', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $value: 'sdsdds' },
  })
  t.deepEqual(resultCollect(r), [{ path: ['text'], value: { za: 'sdsdds' } }])
  t.true(true)
})

test('text default', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $default: 'sdsdds' },
  })

  t.deepEqual(resultCollect(r), [
    { path: ['text'], value: { $default: { za: 'sdsdds' } } },
  ])
})

test('default and lang:default', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $language: 'za',
    text: { $default: 'sdsdds', en: { $default: 'flapflap' } },
  })

  t.deepEqual(resultCollect(r), [
    {
      path: ['text'],
      value: { $default: { za: 'sdsdds', en: 'flapflap' } },
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
    {
      path: ['text'],
      value: { $default: { de: 'dsnfds', en: 'flapflap' } },
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
    {
      path: ['text'],
      value: { $default: { de: 'dsnfds', en: 'flapflap' }, nl: 'flapperonus' },
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
    {
      path: ['text'],
      value: {
        $default: { de: 'dsnfds', en: 'flapflap' },
        nl: 'flapperonus',
        ro: 'durp',
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
    {
      path: ['text'],
      value: {
        nl: 'flapperonus',
        za: 'durp',
        $default: { ae: 'habibi', en: 'flapflap' },
        ro: 'durp',
      },
    },
  ])
})

test('value:wrongpatter, lang, default:lang, lang:value, lang:default', async (t) => {
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

  t.assert(r.errors.length === 4)
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

test('just delete', async (t) => {
  r = await setWalker(schema, {
    $id: 'bl120',
    $delete: true,
  })
  t.true(r.errors === 1)
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
    { path: ['text'], value: { $default: { en: 'title' } } },
  ])
})
