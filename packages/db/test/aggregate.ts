import { equal } from 'node:assert'
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
          // flap: {
          //   props: {
          //     hello: 'uint32',
          //   },
          // },
          country: { type: 'string', maxBytes: 2 },
          // AL: 'uint8',
          // AM: 'uint8',
          // AT: 'uint8',
          AU: 'uint8',
          // AZ: 'uint8',
          // BE: 'uint8',
          // CH: 'uint8',
          // CY: 'uint8',
          // CZ: 'uint8',
          // DE: 'uint8',
          // DK: 'uint8',
          // EE: 'uint8',
          // ES: 'uint8',
          // FI: 'uint8',
          // FR: 'uint8',
          // GB: 'uint8',
          // GE: 'uint8',
          // GR: 'uint8',
          // HR: 'uint8',
          // IE: 'uint8',
          // IL: 'uint8',
          // IS: 'uint8',
          // IT: 'uint8',
          // LT: 'uint8',
          // LU: 'uint8',
          // LV: 'uint8',
          // MD: 'uint8',
          // MT: 'uint8',
          NL: 'uint8',
          // NO: 'uint8',
          // PL: 'uint8',
          // PT: 'uint8',
          // RS: 'uint8',
          // SE: 'uint8',
          // SI: 'uint8',
          // SM: 'uint8',
          // UA: 'uint8',
        },
      },
    },
  })

  // const countries = Object.keys(db.client.schema.types.vote.props).filter(
  //   (v) => v !== 'flap' && v !== 'country',
  // )

  // for (let i = 0; i < 1; i++) {
  //   const x = {
  //     country: allCountryCodes[~~(Math.random() * allCountryCodes.length)],
  //     flap: {
  //       hello: 1,
  //     },
  //   }
  //   for (const key of countries) {
  //     x[key] = ~~(Math.random() * 20)
  //   }
  //   db.create('vote', x)
  // }

  const nl1 = db.create('vote', {
    country: 'bb',
    NL: 10,
    // flap: {
    //   hello: 813,
    // },
  })
  const nl2 = db.create('vote', {
    country: 'aa',
    NL: 20,
    // flap: {
    //   hello: 100,
    // },
  })
  const au1 = db.create('vote', {
    country: 'aa',
    AU: 15,
    // flap: {
    //   hello: 900,
    // },
  })
  const s = db.create('sequence', { votes: [nl1, nl2, au1] })

  // const q2 = await db
  //   .query('sequence')
  //   // .include('votes.NL')
  //   // don't break line
  //   .sum('votes')
  //   .get()

  // console.log(q2.toJSON()) // ok
  // q2.inspect(10) // buggy

  //--------------------------------------------------------
  const q2 = await db
    .query('sequence')
    .include((select) => {
      select('votes')
        // don't break line
        // .groupBy('sequence')
        .sum('NL', 'AU') // 'AU'
      // .include('id')
    })
    .get()
  q2.debug() // ok

  console.info(q2.toObject())

  //--------------------------------------------------------

  const q3 = await db
    .query('sequence')
    .include((select) => {
      select('votes')
        // don't break line
        .groupBy('country')
        .sum('NL', 'AU') // 'AU'
      // .include('id')
    })
    .get()
  console.log('----------')
  q3.debug() // ok
  q3.inspect(10, true)

  // await db.query('vote').sum('NL').get().inspect()

  // console.log(await db.drain())

  // // db.query('NL').sum('NL').get().inspect() // field error

  //--------------------------------------------------------
  // await db.query('vote').sum('NL').get().inspect()
  //--------------------------------------------------------

  // await db.query('vote').count().get().inspect()
  // // ;(await db.query('vote').count().get()).debug()

  // // handle enum
  // // 2 bytes string
  // // var string

  // // ADD COUNT
  // // can use the index in selva if no filter
  // // count is going to be a seperate aggregate (like group)
  // // count is very different in that it does not require a field

  // // const q = await db
  // //   .query('vote')
  // //   .groupBy('country')
  // //   .sum(countries, 'flap.hello')
  // //   .get()
  // //   .inspect()
  // // console.log(q.execTime, q.size, '?')

  // const q2 = await db
  //   .query('vote')
  //   .groupBy('country')
  //   .sum('NL', 'AU')
  //   .get()
  //   .inspect()
  // const q3 = await db.query('vote').groupBy('country').count().get()

  // console.log('count + groupBy + inspect')
  // q3.inspect()
  // console.log('count + groupBy + toObject')
  // console.log(q3.toObject())

  // // this is your goal
  // db.query('sequence')
  //   .include((select) => {
  //     select('votes').groupBy('country').sum('NL', 'AU')
  //   })
  //   .get()

  // // db.query('sequence', seqId)
  // // .include((select) => {
  // //   select('votes').groupBy('country').sum('NL', 'AU')
  // // })
  // // .get()

  // // console.log(q.execTime, q2.size, '?')
  // // q.debug()

  // // add count!

  // // ;(await db.query('vote').sum('flap.hello', 'SM').get()).debug()

  // // console.log(await db.query('vote').sum(countries).get().toObject())

  // // console.log((await db.query('vote').sum(countries).get()).execTime)
  // // ;(await db.query('vote').sum('SM', 'UA').get()).debug()

  // // step 1 make this work
  // // group('country')
  // // ;(await db.query('vote').sum(countries).get()).debug()

  // // console.log((await db.query('vote').sum(countries).get()).toObject())
  // // .mean('ddi1', 'ddi2', 'ddi3', 'ddi4')

  // // console.log((await db.query('vote').sum(countries).get()).execTime, 'ms')
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
