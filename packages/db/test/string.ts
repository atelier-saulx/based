import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { euobserver } from './shared/examples.js'

for (const noCompression of [false, true]) {
  await test(noCompression ? 'simple noCompression' : 'simple', async (t) => {
    const db = new BasedDb({
      path: t.tmp,
      maxModifySize: 1e4,
      noCompression,
    })

    await db.start({ clean: true })

    t.after(() => {
      return db.destroy()
    })

    db.putSchema({
      types: {
        user: {
          props: {
            name: { type: 'string' },
            flap: 'uint32',
            email: { type: 'string', max: 15 },
            age: 'uint32',
            snurp: { type: 'string' },
            burp: 'uint32',
            location: {
              props: {
                label: { type: 'string' },
                x: 'uint32',
                y: 'uint32',
              },
            },
          },
        },
      },
    })

    db.create('user', {
      age: 99,
      burp: 66,
      snurp: 'derp derp',
      email: 'merp_merp@once.net',
      location: {
        label: 'BLA BLA',
      },
    })

    db.drain()

    deepEqual((await db.query('user').get()).toObject(), [
      {
        id: 1,
        name: '',
        flap: 0,
        email: 'merp_merp@once.net',
        age: 99,
        snurp: 'derp derp',
        burp: 66,
        location: { label: 'BLA BLA', x: 0, y: 0 },
      },
    ])
  })
}

await test('string + refs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
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
          name: 'string',
          flap: 'uint32',
          age: 'uint32',
          snurp: 'string',
          burp: 'uint32',
          email: { type: 'string', max: 15 }, // max: 10
          location: {
            props: {
              label: 'string',
              x: 'uint32',
              y: 'uint32',
            },
          },
        },
      },
      blup: {
        props: {
          simple: {
            ref: 'simple',
            prop: 'lilBlup',
          },
          user: {
            ref: 'user',
            prop: 'myBlup',
          },
          flap: {
            type: 'string',
            maxBytes: 1,
          },
          name: 'string',
        },
      },
      simple: {
        // min max on string
        props: {
          countryCode: { type: 'string', maxBytes: 2 },
          lilBlup: {
            ref: 'blup',
            prop: 'simple',
          },
          vectorClock: 'uint32',
          user: {
            ref: 'user',
            prop: 'simple',
          },
        },
      },
    },
  })

  const users = []

  for (let i = 0; i < 1; i++) {
    const blup = db.create('blup', {
      flap: 'A',
    })

    users.push(
      db.create('user', {
        myBlup: blup,
        age: 99,
        name: 'Mr ' + i,
        burp: 66,
        snurp: 'derp derp',
        email: 'merp_merp_' + i + '@once.net',
        location: {
          label: 'BLA BLA',
        },
      }),
    )
  }

  const amount = 1
  for (let i = 0; i < amount; i++) {
    db.create('simple', {
      user: users[~~(Math.random() * users.length)],
      countryCode: 'aa',
      lilBlup: 1,
    })
  }

  db.drain()

  deepEqual(
    (
      await db
        .query('simple')
        .include('user.name', 'user.myBlup.name')
        .range(0, 1)
        .get()
    ).toObject(),
    [
      {
        id: 1,
        user: {
          id: 1,
          name: 'Mr 0',
          myBlup: {
            id: 1,
            name: '',
          },
        },
      },
    ],
  )

  db.create('simple', {
    user: users[~~(Math.random() * users.length)],
  })

  db.drain()

  deepEqual(
    (
      await db.query('simple').include('user.name', 'user.myBlup.name').get()
    ).toObject(),
    [
      {
        id: 1,
        user: null,
      },
      {
        id: 2,
        user: {
          id: 1,
          name: 'Mr 0',
          myBlup: {
            id: 1,
            name: '',
          },
        },
      },
    ],
  )
})

await test('Big string', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      file: {
        props: {
          name: { type: 'string', max: 20 },
          contents: { type: 'string' },
        },
      },
    },
  })

  const file = db.create('file', {
    contents: euobserver,
  })

  db.drain()

  equal(
    (await db.query('file', file).get()).node().contents,
    euobserver,
    'Get single id',
  )

  db.create('file', {
    name: 'file 2',
    contents: euobserver,
  })

  db.drain()

  deepEqual(
    (await db.query('file').get()).toObject(),
    [
      {
        id: 1,
        name: '',
        contents: euobserver,
      },
      {
        id: 2,
        name: 'file 2',
        contents: euobserver,
      },
    ],
    'Get multiple big strings',
  )
})

await test('Big string disable compression', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      file: {
        props: {
          contents: { type: 'string', compression: 'none' },
        },
      },
    },
  })

  const file = db.create('file', {
    contents: euobserver,
  })

  db.drain()

  equal(
    (await db.query('file', file).get()).node().contents,
    euobserver,
    'Get single id',
  )

  db.create('file', {
    contents: euobserver,
  })

  db.drain()

  equal((await db.query('file').get()).size > 1000 * 1e3, true)

  deepEqual(
    (await db.query('file').get()).inspect().toObject(),
    [
      {
        id: 1,
        contents: euobserver,
      },
      {
        id: 2,
        contents: euobserver,
      },
    ],
    'Get multiple big strings (uncompressed)',
  )
})
