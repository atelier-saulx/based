import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { italy } from './shared/examples.js'
import { deepEqual } from './shared/assert.js'

await test('simple', async (t) => {
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

  result = await db.query('dialog').locale('it').include('id', 'fun').get()
  deepEqual(
    result.toObject(),
    [
      {
        id: dialogId,
        fun: italy,
      },
    ],
    'Dialog with locale set to it',
  )

  result = await db
    .query('dialog')
    .locale('it')
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
    .locale('it')
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
    'Filter fun with text italy and locale set to it',
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
    .locale('en')
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
    'Filter fun.it with text italy and locale set to en',
  )

  const mrSnurfInFinland = await db.create(
    'dialog',
    {
      fun: 'mr snurf in finland',
    },
    { locale: 'fi' },
  )

  result = await db.query('dialog').include('id', 'fun').locale('fi').get()
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
    { locale: 'fi' },
  )

  result = await db.query('dialog').include('id', 'fun').locale('fi').get()
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
    .locale('fi')
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

  result = await db
    .query('dialog')
    .locale('fi')
    .include('id', 'fun')
    .filter('fun', '=', 'mr snurf in finland!', { lowerCase: true })
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: 2,
        fun: 'mr snurf in finland!',
      },
    ],
    'Exact match on fi #2',
  )

  console.log('---------------------------------')
  await db.update('dialog', mrSnurfInFinland, {
    fun: { en: 'drink some tea!' },
  })

  result = await db
    .query('dialog')
    .include('fun.en')
    .filter('fun', '=', 'mr snurf in finland!', { lowerCase: true })
    .get()

  deepEqual(
    result.toObject(),
    [
      {
        id: 2,
        fun: { en: 'drink some tea!' },
      },
    ],
    'Include specific language',
  )
})

await test('search', async (t) => {
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

  await db.create('dialog', {
    fun: { en: 'hello its the united kingdom', fi: 'hello its finland' },
  })

  await db.create('dialog', {
    fun: { en: 'its mr derp!', fi: 'its mr snurp!' },
  })

  await db.drain()

  let result = await db
    .query('dialog')
    .include('id', 'fun')
    .search('finland', 'fun')
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: 1,
        fun: {
          en: 'hello its the united kingdom',
          fi: 'hello its finland',
        },
        $searchScore: 0,
      },
    ],
    'Search for finland',
  )

  result = await db
    .query('dialog')
    .include('id', 'fun')
    .search('kingdom', 'fun')
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: 1,
        fun: {
          en: 'hello its the united kingdom',
          fi: 'hello its finland',
        },
        $searchScore: 0,
      },
    ],
    'Search for kingdom',
  )

  result = await db
    .query('dialog')
    .include('id', 'fun')
    .search('snurp', 'fun')
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: 2,
        fun: {
          en: 'its mr derp!',
          fi: 'its mr snurp!',
        },
        $searchScore: 0,
      },
    ],
    'Search for snurp',
  )

  result = await db
    .query('dialog')
    .include('id', 'fun')
    .search('derp', 'fun')
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: 2,
        fun: {
          en: 'its mr derp!',
          fi: 'its mr snurp!',
        },
        $searchScore: 0,
      },
    ],
    'Search for derp',
  )

  result = await db
    .query('dialog')
    .locale('fi')
    .include('id', 'fun')
    .search('derp', 'fun')
    .get()
  deepEqual(result.toObject(), [], 'Search for derp with locale set to fi')

  result = await db
    .query('dialog')
    .locale('en')
    .include('id', 'fun')
    .search('derp', 'fun')
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: 2,
        fun: 'its mr derp!',
        $searchScore: 0,
      },
    ],
    'Search for derp with locale set to en',
  )

  result = await db
    .query('dialog')
    .include('id', 'fun')
    .search('derp', 'fun.en')
    .get()
  deepEqual(
    result.toObject(),
    [
      {
        id: 2,
        fun: {
          en: 'its mr derp!',
          fi: 'its mr snurp!',
        },
        $searchScore: 0,
      },
    ],
    'Search for derp in fun.en',
  )
})

await test('reference text', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    locales: {
      en: { required: true },
      fr: { required: true },
    },
    types: {
      country: {
        name: 'string',
        votingLegal: 'text',
      },
      contestant: {
        name: 'string',
        country: { ref: 'country', prop: 'contestants' },
      },
    },
  })

  const country1 = await db.create('country')

  await db.create('contestant', {
    name: 'New contestant',
    country: country1,
  })

  deepEqual(await db.query('country').include('*').get().toObject(), [
    {
      id: 1,
      name: '',
      votingLegal: {
        en: '',
        fr: '',
      },
    },
  ])

  deepEqual(
    await db.query('contestant').include('*', 'country').get().toObject(),
    [
      {
        id: 1,
        name: 'New contestant',
        country: {
          id: 1,
          name: '',
          votingLegal: {
            en: '',
            fr: '',
          },
        },
      },
    ],
  )
})
