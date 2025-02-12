import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('analytics', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
    types: {
      a: {
        name: 'string',
        bees: {
          items: {
            ref: 'b',
            prop: 'as',
          },
        },
      },
      b: {
        name: 'string',
        as: {
          items: {
            ref: 'a',
            prop: 'bees',
            $power: 'uint8',
          },
        },
      },
    },
  })

  const a = await db.create('a', {})
  const b = await db.create('b', {
    as: [
      {
        id: a,
        $power: 1,
      },
    ],
  })

  await db.update('b', b, {
    as: {
      add: [
        {
          id: a,
          $power: 2,
        },
      ],
    },
  })

  console.log(await db.query('b', b).include('as.$power').get().toObject())

  await db.update('b', b, {
    as: {
      add: [
        {
          id: a,
          $power: { increment: 3 },
        },
      ],
    },
  })

  console.log(await db.query('b', b).include('as.$power').get().toObject())

  await db.update('b', b, {
    as: {
      add: [
        {
          id: a,
          $power: { increment: -4 },
        },
      ],
    },
  })

  console.log(await db.query('b', b).include('as.$power').get().toObject())
})
