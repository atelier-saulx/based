import { deepEqual, throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify json', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        data: 'json',
      },
    },
  })

  const obj = { foo: 'bar', baz: 123, list: [1, 2] }
  const id1 = await db.create('thing', {
    data: obj,
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    data: obj,
  })

  const arr = ['a', 'b', 'c']
  await db.update('thing', id1, {
    data: arr,
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    data: arr,
  })

  // Delete
  await db.update('thing', id1, {
    data: null,
  })
  deepEqual((await db.query('thing', id1).get())?.data, null)
})

await test('modify json on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        data: 'json',
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeData: 'json',
        },
      },
    },
  })

  const obj = { foo: 'bar' }
  const targetId = await db.create('thing', { data: {} })
  const id1 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeData: obj,
    },
  })

  const res1 = await db.query('holder', id1).include('toThing.$edgeData').get()

  deepEqual(res1?.toThing?.$edgeData, obj)

  const obj2 = { baz: 'qux' }
  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeData: obj2,
    },
  })

  const res2 = await db.query('holder', id1).include('toThing.$edgeData').get()
  deepEqual(res2?.toThing?.$edgeData, obj2)
})

await test('modify localized json', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
      de: true,
      nl: true,
    },
    types: {
      thing: {
        content: {
          type: 'json',
          localized: true,
        },
      },
    },
  })

  const id1 = await db.create('thing', {
    content: {
      en: 'Hello',
      de: 'Hallo',
    },
  })

  await throws(
    async () =>
      db.create('thing', {
        content: {
          // @ts-expect-error
          foo: 'bar',
        },
      }),
    'validate localized string',
  )

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    content: {
      en: 'Hello',
      de: 'Hallo',
      nl: null,
    },
  })

  // Update specific locale
  await db.update('thing', id1, {
    content: {
      nl: 'Hallo',
    },
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    content: {
      en: 'Hello',
      de: 'Hallo',
      nl: 'Hallo',
    },
  })

  // Overwrite
  await db.update('thing', id1, {
    content: {
      en: 'Hi',
    },
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    content: {
      en: 'Hi',
      de: 'Hallo',
      nl: 'Hallo',
    },
  })

  // Delete
  await db.update('thing', id1, {
    content: null,
  })
  deepEqual((await db.query('thing', id1).get())!.content, {
    nl: null,
    en: null,
    de: null,
  })
})

await test('modify localized json on edge', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
    },
    types: {
      thing: {
        content: { type: 'json', localized: true },
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeText: { type: 'json', localized: true },
        },
      },
    },
  })

  const targetId = await db.create('thing', { content: { en: 'a' } as any })
  const id1 = await db.create('holder', {
    toThing: {
      id: targetId,
      $edgeText: { en: 'edge hello' } as any,
    },
  })

  const res1 = await db.query('holder', id1).include('toThing.$edgeText').get()

  deepEqual(res1!.toThing?.$edgeText, { en: 'edge hello' })

  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeText: { en: 'edge hi' } as any,
    },
  })

  const res2 = await db.query('holder', id1).include('toThing.$edgeText').get()

  deepEqual(res2!.toThing?.$edgeText, { en: 'edge hi' })
})

await test('modify localized json with locale', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
      de: true,
      nl: true,
    },
    types: {
      thing: {
        content: {
          type: 'json',
          localized: true,
        },
      },
    },
  })

  const id1 = await db.create(
    'thing',
    {
      content: 'Hello',
    },
    { locale: 'en' },
  )

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    content: {
      en: 'Hello',
      de: null,
      nl: null,
    },
  })
})
