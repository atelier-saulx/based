import { BasedDb } from '../src/index.js'
import { allCountryCodes } from './shared/examples.js'
import test from './shared/test.js'

await test('aggregate', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      vote: {
        props: {
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

  // db.create('vote', {
  // country: 'BB',
  // })/

  for (let i = 0; i < 1e6; i++) {
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




  await db.query('vote').sum('NL').get().inspect()

  // handle enum
  // 2 bytes string
  // var string

  // ADD COUNT
  // can use the index in selva if no filter
  // count is going to be a seperate aggregate (like group)
  // count is very different in that it does not require a field

  const q = await db
    .query('vote')
    .groupBy('country')
    .sum(countries, 'flap.hello')
    // .count() just add on $count
    .get()
  // groupBy('country')
  // q.debug()

  // add count!

  console.log(q.toObject().NL, q.execTime, q.size, '?')

  // ;(await db.query('vote').sum('flap.hello', 'SM').get()).debug()

  // console.log(await db.query('vote').sum(countries).get().toObject())

  // console.log((await db.query('vote').sum(countries).get()).execTime)
  // ;(await db.query('vote').sum('SM', 'UA').get()).debug()

  // step 1 make this work
  // group('country')
  // ;(await db.query('vote').sum(countries).get()).debug()

  // console.log((await db.query('vote').sum(countries).get()).toObject())
  // .mean('ddi1', 'ddi2', 'ddi3', 'ddi4')

  // console.log((await db.query('vote').sum(countries).get()).execTime, 'ms')
})
