import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { setTimeout } from 'timers/promises'
import { wait } from '../src/utils/index.js'

await test('single special cases', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          bestBud: {
            ref: 'user',
            prop: 'bestBudOf',
          },
          buddies: {
            items: {
              ref: 'user',
              prop: 'buddies',
            },
          },
        },
      },
    },
  })

  let j = 2
  while (j--) {
    let i = 0
    let prevId
    while (true) {
      const data: any = {
        name: 'user ' + ++i,
        age: i % 100,
      }
      if (prevId) {
        data.bestBud = prevId
        data.buddies = [prevId]
      }

      prevId = db.create('user', data)
      if (i === 5e3) {
        break
      }
    }

    await db.drain()
    await setTimeout(500)
  }

  await db.update('user', 1, {
    name: 'change2',
  })
})

await test('single simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          bla: { type: 'uint32' },
          simple: {
            ref: 'simple',
            prop: 'user',
          },

          name: { type: 'string' },
        },
      },
      simple: {
        props: {
          bla: { type: 'uint32' },
          mySelf: {
            ref: 'simple',
            prop: 'mySelf',
          },
          user: {
            ref: 'user',
            prop: 'simple',
          },
        },
      },
    },
  })

  db.create('simple', {
    user: db.create('user', {
      name: 'Mr snurp',
    }),
  })

  deepEqual(await db.query('simple').include('user.name').get(), [
    {
      id: 1,
      user: {
        id: 1,
        name: 'Mr snurp',
      },
    },
  ])

  db.update('simple', 1, {
    user: null,
  })

  deepEqual(await db.query('simple').include('user.name').get(), [
    {
      id: 1,
      user: null,
    },
  ])

  const x = db.create('user', {
    name: 'Mr snurp',
  })

  const blax = await db.create('simple', {
    user: x,
  })

  const ids: any[] = []
  for (let i = 0; i < 1e5; i++) {
    ids.push(db.create('simple', {}))
  }

  const bla2 = await db.create('simple', {
    user: x,
    mySelf: blax,
  })

  await db.isModified()

  for (let i = 0; i < 1e5; i++) {
    ids.push(db.delete('simple', ids[i]))
  }

  await db.save()

  db.update('simple', blax, {
    mySelf: null,
  })
})

await test('simple nested', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          myBlup: {
            ref: 'blup',
            prop: 'user',
          },
          simple: {
            ref: 'simple',
            prop: 'user',
          },
        },
      },
      blup: {
        props: {
          flap: { type: 'string', maxBytes: 1 },
          user: {
            ref: 'user',
            prop: 'myBlup',
          },
        },
      },
      simple: {
        props: {
          user: {
            ref: 'user',
            prop: 'simple',
          },
        },
      },
    },
  })

  const simple = db.create('simple', {
    user: db.create('user', {
      myBlup: db.create('blup', {
        flap: 'B',
      }),
    }),
  })

  await db.drain()

  deepEqual((await db.query('blup').include('flap').get()).toObject(), [
    {
      id: 1,
      flap: 'B',
    },
  ])

  const result1 = await db.query('user').include('myBlup.flap').get()

  for (const r of result1) {
    equal(r.myBlup.flap, 'B')
  }

  const result = await db.query('simple').include('user.myBlup.flap').get()

  for (const r of result) {
    equal(r.user.myBlup.flap, 'B')
  }

  deepEqual((await db.query('user').include('simple').get()).toObject(), [
    {
      id: 1,
      simple: { id: 1 },
    },
  ])

  db.update('simple', simple, {
    user: null,
  })

  await db.drain()

  deepEqual((await db.query('simple').include('user').get()).toObject(), [
    {
      id: 1,
      user: null,
    },
  ])

  deepEqual((await db.query('user').include('simple').get()).toObject(), [
    {
      id: 1,
      simple: null,
    },
  ])
})

await test('single reference object', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          myBlup: {
            ref: 'blup',
            prop: 'user',
          },
          simple: {
            ref: 'simple',
            prop: 'user',
          },
          admin: {
            ref: 'simple',
            prop: 'admin.user',
          },
        },
      },
      blup: {
        props: {
          user: {
            ref: 'user',
            prop: 'myBlup',
          },
          flap: { type: 'string', maxBytes: 1 },
        },
      },
      simple: {
        props: {
          user: {
            ref: 'user',
            prop: 'simple',
          },
          admin: {
            props: {
              role: { type: 'string' },
              user: {
                ref: 'user',
                prop: 'admin',
              },
            },
          },
        },
      },
    },
  })

  db.create('simple', {
    admin: {
      user: db.create('user', {
        myBlup: db.create('blup', {
          flap: 'B',
        }),
      }),
    },
  })

  await db.drain()

  deepEqual((await db.query('simple').include('admin.user').get()).toObject(), [
    {
      id: 1,
      admin: {
        user: {
          id: 1,
        },
      },
    },
  ])
})

await test('nested', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          myBlup: {
            ref: 'blup',
            prop: 'user',
          },
          simple: {
            ref: 'simple',
            prop: 'user',
          },
          name: { type: 'string' },
          flap: { type: 'uint32' },
          email: { type: 'string', max: 15 },
          age: { type: 'uint32' },
          snurp: { type: 'string' },
          burp: { type: 'uint32' },
          location: {
            props: {
              label: { type: 'string' },
              x: { type: 'uint32' },
              y: { type: 'uint32' },
            },
          },
        },
      },
      blup: {
        props: {
          flap: { type: 'string', maxBytes: 1 },
          name: { type: 'string' },
          user: {
            ref: 'user',
            prop: 'myBlup',
          },
          simple: {
            ref: 'simple',
            prop: 'lilBlup',
          },
        },
      },
      simple: {
        props: {
          countryCode: { type: 'string', maxBytes: 2 },
          lilBlup: {
            ref: 'blup',
            prop: 'simple',
          },
          vectorClock: { type: 'uint32' },
          user: {
            ref: 'user',
            prop: 'simple',
          },
        },
      },
    },
  })

  const blup = db.create('blup', {
    name: 'blup !',
    flap: 'A',
  })

  const user = db.create('user', {
    myBlup: blup,
    age: 99,
    name: 'Jim de Beer',
    email: 'person@once.net',
    flap: 10,
    location: {
      label: 'BLA BLA',
      x: 1,
      y: 2,
    },
  })

  const amount = 1e5
  let lastRes: ReturnType<typeof db.create> | undefined
  for (let i = 0; i < amount; i++) {
    lastRes = db.create('simple', {
      user,
      vectorClock: i,
      countryCode: 'aa',
      lilBlup: blup,
    })
  }

  await db.drain()

  deepEqual(
    (await db.query('simple').include('id').range(0, 1).get()).toObject(),
    [{ id: 1 }],
  )

  deepEqual(
    (await db.query('simple').include('user').range(0, 1).get()).toObject(),
    [
      {
        id: 1,
        user: null,
      },
    ],
    'Get first item user should be null',
  )

  deepEqual(
    (
      await db.query('simple', lastRes).include('user.location').get()
    ).toObject(),
    {
      id: await lastRes,
      user: {
        id: 1,
        location: { label: 'BLA BLA', x: 1, y: 2 },
      },
    },
    'Get user location as part of simple',
  )

  deepEqual(
    (await db.query('simple', lastRes).include('user').get()).toObject(),
    {
      id: await lastRes,
      user: {
        id: 1,
        name: 'Jim de Beer',
        flap: 10,
        email: 'person@once.net',
        age: 99,
        snurp: '',
        burp: 0,
        location: { label: 'BLA BLA', x: 1, y: 2 },
      },
    },
    'Get user as part of simple',
  )

  deepEqual(
    (
      await db
        .query('simple') // lastRes
        .include('user.myBlup')
        .range((await lastRes!) - 1, await lastRes)
        .get()
    ).toObject(),
    [
      {
        id: await lastRes,
        user: { id: 1, myBlup: { id: 1, flap: 'A', name: 'blup !' } },
      },
    ],
    'Get userMyBlup',
  )

  deepEqual(
    (await db.query('simple', lastRes).include('user.myBlup').get()).toObject(),
    {
      id: await lastRes,
      user: { id: 1, myBlup: { id: 1, flap: 'A', name: 'blup !' } },
    },
    'Get single id myBlup ',
  )

  deepEqual(
    (
      await db.query('simple', lastRes).include('user.myBlup', 'lilBlup').get()
    ).toObject(),
    {
      id: await lastRes,
      user: { id: 1, myBlup: { id: 1, flap: 'A', name: 'blup !' } },
      lilBlup: { id: 1, flap: 'A', name: 'blup !' },
    },
    'Get single id myBlup & lilBlup',
  )

  equal(
    (await db.query('simple', lastRes).include('user.myBlup').get()).node().user
      .myBlup.flap,
    'A',
    'Read nested field with getter',
  )

  deepEqual(
    (
      await db
        .query('simple')
        .include('user.myBlup', 'lilBlup', 'user.name')
        .range((await lastRes!) - 1, await lastRes)
        .get()
    ).toObject(),
    [
      {
        id: await lastRes,
        user: {
          id: 1,
          myBlup: { id: 1, flap: 'A', name: 'blup !' },
          name: 'Jim de Beer',
        },
        lilBlup: { id: 1, flap: 'A', name: 'blup !' },
      },
    ],
    'Get user.name, user.myBlup and lilBlup of offset last',
  )

  deepEqual(
    (
      await db.query('simple', lastRes).include('user.location.label').get()
    ).toObject(),
    { id: await lastRes, user: { id: 1, location: { label: 'BLA BLA' } } },
  )

  deepEqual(
    (
      await db.query('simple', lastRes).include('user.location').get()
    ).toObject(),
    {
      id: await lastRes,
      user: { id: 1, location: { label: 'BLA BLA', x: 1, y: 2 } },
    },
  )

  deepEqual(
    (
      await db
        .query('simple')
        .include('user.myBlup', 'lilBlup')
        .range((await lastRes!) - 1, await lastRes)
        .get()
    ).toObject(),
    [
      {
        id: await lastRes,
        user: {
          id: 1,
          myBlup: {
            id: 1,
            flap: 'A',
            name: 'blup !',
          },
        },
        lilBlup: {
          id: 1,
          flap: 'A',
          name: 'blup !',
        },
      },
    ],
  )

  deepEqual(
    (
      await db
        .query('simple')
        .include('user', 'user.myBlup')
        .range((await lastRes!) - 1, await lastRes)
        .get()
    ).toObject(),
    [
      {
        id: await lastRes,
        user: {
          id: 1,
          name: 'Jim de Beer',
          flap: 10,
          email: 'person@once.net',
          age: 99,
          snurp: '',
          burp: 0,
          location: { label: 'BLA BLA', x: 1, y: 2 },
          myBlup: { id: 1, flap: 'A', name: 'blup !' },
        },
      },
    ],
    'get nested userMyBlup and user',
  )

  deepEqual(
    (
      await db
        .query('simple', lastRes)
        .include('user', 'user.myBlup', 'lilBlup')
        .get()
    ).toObject(),
    {
      id: await lastRes,
      user: {
        id: 1,
        name: 'Jim de Beer',
        flap: 10,
        email: 'person@once.net',
        age: 99,
        snurp: '',
        burp: 0,
        location: { label: 'BLA BLA', x: 1, y: 2 },
        myBlup: { id: 1, flap: 'A', name: 'blup !' },
      },
      lilBlup: { id: 1, flap: 'A', name: 'blup !' },
    },
  )
})

await test('single reference multi refs strings', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          myBlup: {
            ref: 'blup',
            prop: 'user',
          },
          simple: {
            ref: 'simple',
            prop: 'user',
          },
        },
      },
      blup: {
        props: {
          user: {
            ref: 'user',
            prop: 'myBlup',
          },
          simple: {
            ref: 'simple',
            prop: 'lilBlup',
          },
          name: { type: 'string' },
          flap: { type: 'string', maxBytes: 1 },
        },
      },
      simple: {
        props: {
          age: { type: 'uint32' },
          lilBlup: {
            ref: 'blup',
            prop: 'simple',
          },
          user: {
            ref: 'user',
            prop: 'simple',
          },
        },
      },
    },
  })

  const blup = db.create('blup', {
    flap: 'B',
  })

  db.create('simple', {
    user: db.create('user', {
      name: 'mr snurp',
      myBlup: blup,
    }),
    lilBlup: blup,
  })

  await db.drain()

  const result = await db
    .query('simple')
    .include('user', 'user.myBlup', 'lilBlup')
    .get()

  for (const r of result) {
    equal(r.lilBlup.name, '')
  }

  db.create('simple', {
    age: 5,
  })

  await db.drain()

  const result2 = await db
    .query('simple')
    .filter('age', '=', 5)
    .include('user', 'user.myBlup', 'lilBlup')
    .get()

  deepEqual(result2.toObject(), [
    {
      id: 2,
      user: null,
      lilBlup: null,
    },
  ])
})

await test('update same value', async (t) => {
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
      },
      contestant: {
        name: 'string',
        country: { ref: 'country', prop: 'contestants' },
      },
    },
  })

  const id = await db.create('contestant', {
    name: 'Mr flap',
  })

  const countryId = await db.create('country', {
    name: 'Country X',
  })

  await db.update('contestant', {
    id,
    country: countryId,
  })

  await db.update('contestant', {
    id,
    country: countryId,
  })

  await wait(1e3)
})
