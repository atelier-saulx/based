import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify text', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
      de: true,
      nl: true,
    },
    types: {
      thing: {
        content: 'text',
      },
    },
  })

  const id1 = await db.create('thing', {
    content: {
      en: 'Hello',
      de: 'Hallo',
    } as any,
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    content: {
      en: 'Hello',
      de: 'Hallo',
    },
  })

  // Update specific locale
  await db.update('thing', id1, {
    content: {
      nl: 'Hallo',
    } as any,
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
    } as any,
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    content: {
      en: 'Hi',
      de: 'Hallo',
      nl: 'Hallo',
    },
  })
})

await test('modify text on edge', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
    },
    types: {
      thing: {
        content: 'text',
      },
      holder: {
        toThing: {
          ref: 'thing',
          prop: 'holders',
          $edgeText: 'text',
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

  const res1 = await db
    .query('holder', id1)
    .include('toThing.$edgeText')
    .get()
    .toObject()

  deepEqual(res1.toThing?.$edgeText, { en: 'edge hello' })

  await db.update('holder', id1, {
    toThing: {
      id: targetId,
      $edgeText: { en: 'edge hi' } as any,
    },
  })

  const res2 = await db
    .query('holder', id1)
    .include('toThing.$edgeText')
    .get()
    .toObject()
  deepEqual(res2.toThing?.$edgeText, { en: 'edge hi' })
})
