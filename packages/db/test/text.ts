import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { italy } from './shared/examples.js'
import { deepEqual } from './shared/assert.js'

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  db.setSchema({
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
  t.after(() => t.backup(db))

  db.setSchema({
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
    result,
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
  t.after(() => t.backup(db))

  await db.setSchema({
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

await test('sort', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  db.setSchema({
    locales: {
      en: {},
      it: { fallback: ['en'] },
      fi: { fallback: ['en'] },
    },
    types: {
      dialog: {
        snurf: 'string',
        fun: {
          type: 'text',
        },
      },
    },
  })

  await db.query('dialog').locale('fi').sort('fun', 'desc').get()

  const id1 = await db.create('dialog', {
    fun: { en: '3 en', fi: '1' },
    snurf: '1',
  })

  const id2 = await db.create('dialog', {
    fun: { en: '2 en', fi: '2' },
    snurf: '2',
  })

  const id3 = await db.create('dialog', {
    fun: { en: '1 en', fi: '3' },
    snurf: '3',
  })

  const id4 = await db.create('dialog', {})

  const id5 = await db.create('dialog', {
    fun: { it: 'derp' },
    snurf: '4',
  })

  deepEqual(
    await db
      .query('dialog')
      .include('fun')
      .locale('fi')
      .sort('fun', 'desc')
      .get(),
    [
      {
        id: 3,
        fun: '3',
      },
      {
        id: 2,
        fun: '2',
      },
      {
        id: 1,
        fun: '1',
      },
      {
        id: 4,
        fun: '',
      },
      {
        id: 5,
        fun: '',
      },
    ],
    'Sort 1',
  )

  deepEqual(
    await db.query('dialog').include('fun').sort('fun.fi', 'desc').get(),
    [
      { id: 3, fun: { en: '1 en', fi: '3', it: '' } },
      { id: 2, fun: { en: '2 en', fi: '2', it: '' } },
      { id: 1, fun: { en: '3 en', fi: '1', it: '' } },
      { id: 4, fun: { en: '', it: '', fi: '' } },
      { id: 5, fun: { en: '', it: 'derp', fi: '' } },
    ],
  )

  deepEqual(
    await db
      .query('dialog')
      .locale('en')
      .include('fun')
      .sort('fun', 'desc')
      .get(),
    [
      { id: 1, fun: '3 en' },
      { id: 2, fun: '2 en' },
      { id: 3, fun: '1 en' },
      { id: 4, fun: '' },
      { id: 5, fun: '' },
    ],
  )

  await db.update('dialog', id5, {
    fun: { fi: '0' },
  })

  deepEqual(
    await db
      .query('dialog')
      .locale('fi')
      .include('fun')
      .sort('fun', 'desc')
      .get(),
    [
      {
        id: 3,
        fun: '3',
      },
      {
        id: 2,
        fun: '2',
      },
      {
        id: 1,
        fun: '1',
      },
      {
        id: 5,
        fun: '0',
      },
      {
        id: 4,
        fun: '',
      },
    ],
  )

  await db.delete('dialog', id5)

  deepEqual(
    await db
      .query('dialog')
      .locale('fi')
      .include('fun')
      .sort('fun', 'desc')
      .get(),
    [
      {
        id: 3,
        fun: '3',
      },
      {
        id: 2,
        fun: '2',
      },
      {
        id: 1,
        fun: '1',
      },
      {
        id: 4,
        fun: '',
      },
    ],
  )

  deepEqual(await db.query('dialog').locale('fi').sort('snurf', 'desc').get(), [
    { id: 3, fun: '3', snurf: '3' },
    { id: 2, fun: '2', snurf: '2' },
    { id: 1, fun: '1', snurf: '1' },
    { id: 4, snurf: '', fun: '' },
  ])

  db.update('dialog', id1, {
    fun: null,
  })

  await db.drain()

  db.update('dialog', id1, {
    snurf: null,
  })

  await db.drain()

  deepEqual(await db.query('dialog').locale('fi').sort('snurf', 'desc').get(), [
    { id: 3, fun: '3', snurf: '3' },
    { id: 2, fun: '2', snurf: '2' },
    { id: 1, fun: '', snurf: '' },
    { id: 4, snurf: '', fun: '' },
  ])

  deepEqual(await db.query('dialog').locale('fi').sort('fun').get(), [
    { id: 4, snurf: '', fun: '' },
    { id: 1, fun: '', snurf: '' },
    { id: 2, fun: '2', snurf: '2' },
    { id: 3, fun: '3', snurf: '3' },
  ])

  db.update('dialog', id3, {
    fun: null,
  })

  await db.drain()

  deepEqual(await db.query('dialog').locale('fi').sort('fun').get(), [
    { id: 4, snurf: '', fun: '' },
    { id: 3, snurf: '3', fun: '' },
    { id: 1, snurf: '', fun: '' },
    { id: 2, fun: '2', snurf: '2' },
  ])

  db.update(
    'dialog',
    id3,
    {
      fun: '0',
    },
    { locale: 'fi' },
  )
  await db.drain()

  deepEqual(await db.query('dialog').locale('fi').sort('fun').get(), [
    { id: 4, snurf: '', fun: '' },
    { id: 1, snurf: '', fun: '' },
    { id: 3, snurf: '3', fun: '0' },
    { id: 2, fun: '2', snurf: '2' },
  ])

  db.update(
    'dialog',
    id3,
    {
      fun: null,
    },
    { locale: 'fi' },
  )
  await db.drain()

  deepEqual(
    await db.query('dialog').locale('fi').sort('fun').get(),
    [
      { id: 4, snurf: '', fun: '' },
      { id: 3, snurf: '3', fun: '' },
      { id: 1, snurf: '', fun: '' },
      { id: 2, fun: '2', snurf: '2' },
    ],
    'After removal of a whole field',
  )

  db.update('dialog', id3, {
    fun: {
      fi: '0',
    },
  })
  await db.drain()

  deepEqual(
    await db.query('dialog').locale('fi').sort('fun').get(),
    [
      { id: 4, snurf: '', fun: '' },
      { id: 1, snurf: '', fun: '' },
      { id: 3, snurf: '3', fun: '0' },
      { id: 2, fun: '2', snurf: '2' },
    ],
    'Fun dialog',
  )

  db.update('dialog', id3, {
    fun: {
      fi: 'a',
    },
  })
  await db.drain()

  db.update('dialog', id3, {
    fun: {
      fi: null,
    },
  })
  await db.drain()

  deepEqual(
    await db.query('dialog').locale('fi').sort('fun').get(),
    [
      { id: 4, snurf: '', fun: '' },
      { id: 3, snurf: '3', fun: '' },
      { id: 1, snurf: '', fun: '' },
      { id: 2, fun: '2', snurf: '2' },
    ],
    'setting lang in object to null',
  )
})

await test('in object only', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: {
      en: {},
      it: {},
    },
    types: {
      user: {
        dict: {
          type: 'object',
          props: {
            nice: 'text',
          },
        },
      },
    },
  })

  const user1 = await db.create('user', {
    dict: {
      nice: {
        en: 'a',
      },
    },
  })

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    dict: { nice: { en: 'a', it: '' } },
  })
})

await test('correct return from obj', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: {
      en: {},
      it: {},
    },
    types: {
      user: {
        name: 'text',
        dict: {
          type: 'object',
          props: {
            nice: 'text',
          },
        },
      },
    },
  })

  const user1 = await db.create('user', {
    dict: {
      nice: {
        en: 'cool guy',
      },
    },
  })

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    dict: { nice: { en: 'cool guy', it: '' } },
    name: { en: '', it: '' },
  })
})

await test('clear field', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: {
      en: {},
      it: {},
    },
    types: {
      user: {
        name: 'text',
      },
    },
  })

  const user1 = await db.create('user', {
    name: { en: 'coolnameEN', it: 'coolnameIT' },
  })

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    name: { en: 'coolnameEN', it: 'coolnameIT' },
  })

  await db.update(
    'user',
    user1,
    {
      name: '',
    },
    { locale: 'en' },
  )

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    name: { en: '', it: 'coolnameIT' },
  })
})

await test('text and compression', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: {
      en: {},
      it: {},
    },
    types: {
      user: {
        article: 'text',
      },
    },
  })

  const user1 = await db.create('user', {
    article: { en: italy, it: 'cool' },
  })

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    article: { en: italy, it: 'cool' },
  })

  await db.query('user', user1).get().inspect()

  await db.update(
    'user',
    user1,
    {
      article: '',
    },
    { locale: 'en' },
  )

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    article: { en: '', it: 'cool' },
  })
})
