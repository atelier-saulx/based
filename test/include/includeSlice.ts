import test from '../shared/test.js'
import { testDb } from '../shared/index.js'
import { italy } from '../shared/examples.js'
import { deepEqual, equal } from '../shared/assert.js'

await test('slice string / text', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: {},
      it: {},
      fi: {},
    },
    types: {
      item: {
        props: {
          x: 'uint32',
          name: 'string',
          body: 'text',
          a: 'string',
          b: 'string',
          c: 'string',
          d: 'string',
          e: 'string',
          f: 'string',
          g: 'string',
          h: 'string',
          flags: 'string',
          bigBoyString: 'string',
        },
      },
    },
  })

  let bigBoyString = '🤪🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸🇺🇸🇿🇼🇺🇸'
  for (let i = 0; i < 200; i++) {
    bigBoyString += 'a'
  }

  const id1 = await db.create('item', {
    name: 'abcdefg',
    b: italy,
    c: '🤪💩👌⚡️🤪💩👌⚡️',
    d: 'üaßßa',
    e: '你a好AAAA',
    f: '€Abc',
    g: 'éAAAA',
    h: '🚀🚀🚀🚀🚀🚀🚀',
    flags: '🇺🇸🇿🇼🇺🇸',
    bigBoyString,
    body: {
      en: bigBoyString,
      it: 'abcdefg',
      fi: 'finland 🇫🇮! this is finland!',
    },
  })

  const q = await db.query('item', 1).get()
  equal(q.id, 1)

  deepEqual(
    await db
      .query('item', id1)
      .include('name', {
        end: 1,
        meta: true,
      })
      .include('d', {
        end: 4,
      })
      .include('flags', {
        end: 2,
      })
      .include('e', {
        end: 1,
      })
      .include('f', {
        end: 1,
      })
      .include('b', {
        end: 50,
      })
      .include('c', {
        end: 1,
      })
      .include('g', {
        end: 1,
      })
      .include('e', {
        end: 3,
      })
      .include('bigBoyString', { meta: true, end: 3 })
      .get(),
    {
      id: 1,
      name: {
        checksum: 8097896832434183,
        size: 7,
        crc32: 3861378113,
        compressed: false,
        value: 'a',
      },
      d: 'üaßß',
      flags: '🇺🇸🇿🇼',
      e: '你a好',
      f: '€',
      c: '🤪',
      g: 'é',
      bigBoyString: {
        checksum: 6678244981997910,
        size: 342,
        crc32: 3184435359,
        compressed: true,
        value: '🤪🇺🇸🇿🇼',
      },
      b: '\nMain menu\n\nWikipediaThe Free Encyclopedia\nSearch ',
    },
    'Strings + chars',
  )

  deepEqual(
    await db.query('item', id1).include('body', { end: 3 }).get(),
    { id: 1, body: { en: '🤪🇺🇸🇿🇼', fi: 'fin', it: 'abc' } },
    'Text all + chars',
  )

  deepEqual(
    await db
      .query('item', id1)
      .include('body.fi', { end: 3 }, 'body.en', { end: 3 })
      .get(),
    { id: 1, body: { en: '🤪🇺🇸🇿🇼', fi: 'fin' } },
    'Text specific',
  )

  deepEqual(
    await db.query('item', id1).include('body', { end: 3 }).locale('en').get(),
    { id: 1, body: '🤪🇺🇸🇿🇼' },
    'Text specific locale',
  )

  deepEqual(
    await db
      .query('item', id1)
      .include('body', { end: 4, bytes: true })
      .locale('en')
      .get(),
    { id: 1, body: '🤪' },
    'Text specific locale bytes',
  )

  deepEqual(
    await db.query('item', id1).include('body.en', { end: 3 }, 'body.fi').get(),
    { id: 1, body: { en: '🤪🇺🇸🇿🇼', fi: 'finland 🇫🇮! this is finland!' } },
    'Different ends per language',
  )
})
