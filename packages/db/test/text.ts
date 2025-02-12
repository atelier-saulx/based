import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { italy } from './shared/examples.js'
import { deepEqual } from './shared/assert.js'

await test('text', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    locales: {
      en: {},
      it: { fallback: ['en'] },
      fi: { fallback: ['en'] },
    },
    types: {
      dialog: {
        props: {
          fun: {
            type: 'text',
          },
        },
      },
    },
  })

  const dialogId = await db.create('dialog', {
    fun: { en: '1', it: italy, fi: '3' },
  })

  await db.drain()

  let result = await db.query('dialog').include('id', 'fun').get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
        fun: {
          en: '1',
          it: italy,
          fi: '3',
        },
      },
    ],
    'Initial dialog with fun property',
  )

  result = await db.query('dialog').include('id').get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
      },
    ],
    'Dialog with only id included',
  )

  result = await db.query('dialog').i18n('it').include('id', 'fun').get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
        fun: italy,
      },
    ],
    'Dialog with i18n set to it',
  )

  result = await db
    .query('dialog')
    .i18n('it')
    .include('id', 'fun')
    .filter('fun', 'has', 'fliperdieflaperdiefloep', { lowerCase: true })
    .get()
  deepEqual(result.toObject(), [], 'Filter fun with non-existent text')

  result = await db
    .query('dialog')
    .include('id', 'fun')
    .filter('fun', 'has', 'italy', { lowerCase: true })
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
        fun: {
          en: '1',
          it: italy,
          fi: '3',
        },
      },
    ],
    'Filter fun with text italy',
  )

  result = await db
    .query('dialog')
    .i18n('it')
    .include('id', 'fun')
    .filter('fun', 'has', 'italy', { lowerCase: true })
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
        fun: italy,
      },
    ],
    'Filter fun with text italy and i18n set to it',
  )

  result = await db
    .query('dialog')
    .include('id', 'fun')
    .filter('fun.en', 'has', 'italy', { lowerCase: true })
    .get()
  deepEqual(result.toObject(), [], 'Filter fun.en with text italy')

  result = await db
    .query('dialog')
    .include('id', 'fun')
    .filter('fun.it', 'has', 'italy', { lowerCase: true })
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
        fun: {
          en: '1',
          it: italy,
          fi: '3',
        },
      },
    ],
    'Filter fun.it with text italy',
  )

  result = await db
    .query('dialog')
    .i18n('en')
    .include('id', 'fun')
    .filter('fun.it', 'has', 'italy', { lowerCase: true })
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: 1,
        fun: '1',
      },
    ],
    'Filter fun.it with text italy and i18n set to en',
  )

  const mrSnurfInFinland = await db.create(
    'dialog',
    {
      fun: 'mr snurf in finland',
    },
    { i18n: 'fi' },
  )

  result = await db.query('dialog').include('id', 'fun').i18n('fi').get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
        fun: '3',
      },
      {
        id: mrSnurfInFinland,
        fun: 'mr snurf in finland',
      },
    ],
    'Dialog with mr snurf in finland',
  )

  await db.update(
    'dialog',
    mrSnurfInFinland,
    {
      fun: 'mr snurf in finland!',
    },
    { i18n: 'fi' },
  )

  result = await db.query('dialog').include('id', 'fun').i18n('fi').get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
        fun: '3',
      },
      {
        id: mrSnurfInFinland,
        fun: 'mr snurf in finland!',
      },
    ],
    'Updated mr snurf in finland',
  )

  const derpderp = await db.create('dialog', {})

  result = await db.query('dialog', mrSnurfInFinland).get()
  deepEqual(
    result.toObject(),
    {
      id: mrSnurfInFinland,
      fun: {
        fi: 'mr snurf in finland!',
        en: '',
        it: '',
      },
    },
    'Query mr snurf in finland',
  )

  result = await db.query('dialog', derpderp).get()
  deepEqual(
    result.toObject(),
    {
      id: derpderp,
      fun: {
        en: '',
        it: '',
        fi: '',
      },
    },
    'Query empty dialog',
  )

  result = await db
    .query('dialog')
    .i18n('fi')
    .include('id', 'fun')
    .filter('fun', '=', '3', { lowerCase: true })
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
        fun: '3',
      },
    ],
    'Exact match on fi',
  )
})
