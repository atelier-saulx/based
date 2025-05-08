import { equal, deepEqual } from 'node:assert'
import { BasedDb } from '../src/index.js'
import { allCountryCodes } from './shared/examples.js'
import test from './shared/test.js'

await test('aggregate', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  // t.after(() => t.backup(db))
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      sequence: {
        props: {
          votes: {
            items: {
              ref: 'vote',
              prop: 'sequence',
            },
          },
        },
      },
      vote: {
        props: {
          sequence: {
            ref: 'sequence',
            prop: 'votes',
          },
          country: { type: 'string', maxBytes: 2 },
          AU: 'uint8',
          NL: 'uint8',
        },
      },
    },
  })
  const nl1 = db.create('vote', {
    country: 'bb',
    NL: 10,
  })
  const nl2 = db.create('vote', {
    country: 'aa',
    NL: 20,
  })
  const au1 = db.create('vote', {
    country: 'aa',
    AU: 15,
  })
  const s = db.create('sequence', { votes: [nl1, nl2, au1] })

  deepEqual(
    await db.query('vote').sum('NL').get().toObject(),
    { NL: 30 },
    'sum, top level, single prop',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'aa')
      .sum('NL')
      .get()
      .toObject(),
    { NL: 20 },
    'sum with filter',
  )

  // top level  ----------------------------------
  deepEqual(
    await db.query('vote').sum('NL', 'AU').get().toObject(),
    { NL: 30, AU: 15 },
    'sum, top level, multiple props',
  )

  deepEqual(
    await db.query('vote').sum().get().toObject(),
    {},
    'sum() returning nothing',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'zz')
      .sum('NL')
      .get()
      .toObject(),
    { NL: 0 },
    'sum with empty result set',
  )

  // groupBy  ----------------------------------

  deepEqual(
    await db.query('vote').sum('NL', 'AU').groupBy('country').get().toObject(),
    { bb: { NL: 10, AU: 0 }, aa: { NL: 20, AU: 15 } },
    'sum, top level, groupBy',
  )

  deepEqual(
    await db.query('vote').groupBy('country').get().toObject(),
    { bb: {}, aa: {} },
    'groupBy with no aggregation function',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'bb')
      .groupBy('country')
      .sum('NL', 'AU')
      .get()
      .toObject(),
    { bb: { NL: 10, AU: 0 } },
    'filter, groupBy on single distinct value',
  )

  // branched includes ----------------------------------
  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').sum('NL', 'AU')
      })
      .get()
      .toObject(),
    [{ id: 1, votes: { NL: 30, AU: 15 } }],
    'brached include, sum, references',
  )

  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').groupBy('country').sum('NL', 'AU')
      })
      .get()
      .toObject(),
    [{ id: 1, votes: { aa: { AU: 15, NL: 20 }, bb: { AU: 0, NL: 10 } } }],
    'branched include, references, groupBy',
  )

  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').filter('country', '=', 'aa').sum('NL', 'AU')
      })
      .get()
      .toObject(),
    [{ id: 1, votes: { NL: 20, AU: 15 } }],
    'branched include, references, filtered, groupBy',
  )

  // await db.query('vote').count().get().inspect()
  // // ;(await db.query('vote').count().get()).debug()

  // // handle enum
  // // 2 bytes string
  // // var string

  // // ADD COUNT
  // // can use the index in selva if no filter
  // // count is going to be a seperate aggregate (like group)
  // // count is very different in that it does not require a field

  // console.log('count + groupBy + inspect')
  // q3.inspect()
  // console.log('count + groupBy + toObject')
  // console.log(q3.toObject())

  // // ;(await db.query('vote').sum('flap.hello', 'SM').get()).debug()

  // // console.log((await db.query('vote').sum(countries).get()).execTime)

  // // .mean('ddi1', 'ddi2', 'ddi3', 'ddi4')
})

await test('batch', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  // t.after(() => t.backup(db))
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      sequence: {
        props: {
          votes: {
            items: {
              ref: 'vote',
              prop: 'sequence',
            },
          },
        },
      },
      vote: {
        props: {
          sequence: {
            ref: 'sequence',
            prop: 'votes',
          },
          flap: {
            props: {
              hello: 'uint32',
            },
          },
          country: { type: 'string', maxBytes: 2 },
          AL: 'uint8',
          AM: 'uint8',
          AT: 'uint8',
          AU: 'uint8',
          AZ: 'uint8',
          BE: 'uint8',
          CH: 'uint8',
          CY: 'uint8',
          CZ: 'uint8',
          DE: 'uint8',
          DK: 'uint8',
          EE: 'uint8',
          ES: 'uint8',
          FI: 'uint8',
          FR: 'uint8',
          GB: 'uint8',
          GE: 'uint8',
          GR: 'uint8',
          HR: 'uint8',
          IE: 'uint8',
          IL: 'uint8',
          IS: 'uint8',
          IT: 'uint8',
          LT: 'uint8',
          LU: 'uint8',
          LV: 'uint8',
          MD: 'uint8',
          MT: 'uint8',
          NL: 'uint8',
          NO: 'uint8',
          PL: 'uint8',
          PT: 'uint8',
          RS: 'uint8',
          SE: 'uint8',
          SI: 'uint8',
          SM: 'uint8',
          UA: 'uint8',
        },
      },
    },
  })

  const countries = Object.keys(db.client.schema.types.vote.props).filter(
    (v) => v !== 'flap' && v !== 'country',
  )

  for (let i = 0; i < 1; i++) {
    const x = {
      country: allCountryCodes[~~(Math.random() * allCountryCodes.length)],
      flap: {
        hello: 1,
      },
    }
    for (const key of countries) {
      x[key] = ~~(Math.random() * 20)
    }
    db.create('vote', x)
  }

  console.log(await db.drain())
})

await test('top level count', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      sequence: {
        bla: 'uint32',
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('sequence', { bla: i })
  }

  await db.drain()

  const q = await db.query('sequence').count().get().inspect()

  equal(q.toObject().$count, 1e6)
})
