import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { SchemaType } from '@based/schema'
import { deepEqual, perf } from '../shared/assert.js'
import { fastPrng } from '@based/utils'
import { equal } from 'node:assert'

await test('overall performance', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  const types = ['IPA', 'Lager', 'Ale', 'Stout', 'Wit', 'Dunkel', 'Tripel']
  await db.setSchema({
    types: {
      beer: {
        props: {
          name: 'string',
          type: types,
          price: 'number',
          bitterness: 'number',
          alchol: 'number',
          year: 'number',
        },
      },
    },
  })

  const beers = 1e6
  const years = [1940, 1990, 2013, 2006]
  const rnd = fastPrng()
  for (let i = 0; i < beers; i++) {
    await db.create('beer', {
      name: 'Beer' + i,
      type: types[rnd(0, types.length - 1)],
      price: Math.random() * 100,
      year: years[rnd(0, years.length - 1)],
    })
  }
  await db.drain()

  await perf(async () => {
    await db.query('beer').sum('price').get()
  }, 'main agg')

  await perf(async () => {
    await db.query('beer').groupBy('year').get()
  }, 'group by year')

  await perf(async () => {
    await db.query('beer').groupBy('type').get()
  }, 'group by enum main')

  await perf(async () => {
    await db.query('beer').max('price').groupBy('type').get()
  }, 'agg + enum main group by')
})

await test('count top level bignumber', async (t) => {
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

  const q = await db.query('sequence').count().get()
  equal(q.toObject().count, 1e6)
})

await test('many countries', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  const countrySchema: SchemaType = {
    props: {
      AF: 'uint8',
      AL: 'uint8',
      DZ: 'uint8',
      AD: 'uint8',
      AO: 'uint8',
      AG: 'uint8',
      AR: 'uint8',
      AM: 'uint8',
      AU: 'uint8',
      AT: 'uint8',
      AZ: 'uint8',
      BS: 'uint8',
      BH: 'uint8',
      BD: 'uint8',
      BB: 'uint8',
      BY: 'uint8',
      BE: 'uint8',
      BZ: 'uint8',
      BJ: 'uint8',
      BT: 'uint8',
      BO: 'uint8',
      BA: 'uint8',
      BW: 'uint8',
      BR: 'uint8',
      BN: 'uint8',
      BG: 'uint8',
      BF: 'uint8',
      BI: 'uint8',
      CV: 'uint8',
      KH: 'uint8',
      CM: 'uint8',
      CA: 'uint8',
      CF: 'uint8',
      TD: 'uint8',
      CL: 'uint8',
      CN: 'uint8',
      CO: 'uint8',
      KM: 'uint8',
      CG: 'uint8',
      CD: 'uint8',
      CR: 'uint8',
      CI: 'uint8',
      HR: 'uint8',
      CU: 'uint8',
      CY: 'uint8',
      CZ: 'uint8',
      DK: 'uint8',
      DJ: 'uint8',
      DM: 'uint8',
      DO: 'uint8',
      EC: 'uint8',
      EG: 'uint8',
      SV: 'uint8',
      GQ: 'uint8',
      ER: 'uint8',
      EE: 'uint8',
      SZ: 'uint8',
      ET: 'uint8',
      FJ: 'uint8',
      FI: 'uint8',
      FR: 'uint8',
      GA: 'uint8',
      GM: 'uint8',
      GE: 'uint8',
      DE: 'uint8',
      GH: 'uint8',
      GR: 'uint8',
      GD: 'uint8',
      GT: 'uint8',
      GN: 'uint8',
      GW: 'uint8',
      GY: 'uint8',
      HT: 'uint8',
      HN: 'uint8',
      HU: 'uint8',
      IS: 'uint8',
      IN: 'uint8',
      ID: 'uint8',
      IR: 'uint8',
      IQ: 'uint8',
      IE: 'uint8',
      IL: 'uint8',
      IT: 'uint8',
      JM: 'uint8',
      JP: 'uint8',
      JO: 'uint8',
      KZ: 'uint8',
      KE: 'uint8',
      KI: 'uint8',
      KP: 'uint8',
      KR: 'uint8',
      KW: 'uint8',
      KG: 'uint8',
      LA: 'uint8',
      LV: 'uint8',
      LB: 'uint8',
      LS: 'uint8',
      LR: 'uint8',
      LY: 'uint8',
      LI: 'uint8',
      LT: 'uint8',
      LU: 'uint8',
      MG: 'uint8',
      MW: 'uint8',
      MY: 'uint8',
      MV: 'uint8',
      ML: 'uint8',
      MT: 'uint8',
      MH: 'uint8',
      MR: 'uint8',
      MU: 'uint8',
      MX: 'uint8',
      FM: 'uint8',
      MD: 'uint8',
      MC: 'uint8',
      MN: 'uint8',
      ME: 'uint8',
      MA: 'uint8',
      MZ: 'uint8',
      MM: 'uint8',
      NA: 'uint8',
      NR: 'uint8',
      NP: 'uint8',
      NL: 'uint8',
      NZ: 'uint8',
      NI: 'uint8',
      NE: 'uint8',
      NG: 'uint8',
      MK: 'uint8',
      NO: 'uint8',
      OM: 'uint8',
      PK: 'uint8',
      PW: 'uint8',
      PA: 'uint8',
      PG: 'uint8',
      PY: 'uint8',
      PE: 'uint8',
      PH: 'uint8',
      PL: 'uint8',
      PT: 'uint8',
      QA: 'uint8',
      RO: 'uint8',
      RU: 'uint8',
      RW: 'uint8',
      KN: 'uint8',
      LC: 'uint8',
      VC: 'uint8',
      WS: 'uint8',
      SM: 'uint8',
      ST: 'uint8',
      SA: 'uint8',
      SN: 'uint8',
      RS: 'uint8',
      SC: 'uint8',
      SL: 'uint8',
      SG: 'uint8',
      SK: 'uint8',
      SI: 'uint8',
      SB: 'uint8',
      SO: 'uint8',
      ZA: 'uint8',
      SS: 'uint8',
      ES: 'uint8',
      LK: 'uint8',
      SD: 'uint8',
      SR: 'uint8',
      SE: 'uint8',
      CH: 'uint8',
      SY: 'uint8',
      TJ: 'uint8',
      TZ: 'uint8',
      TH: 'uint8',
      TL: 'uint8',
      TG: 'uint8',
      TO: 'uint8',
      TT: 'uint8',
      TN: 'uint8',
      TR: 'uint8',
      TM: 'uint8',
      TV: 'uint8',
      UG: 'uint8',
      UA: 'uint8',
      AE: 'uint8',
      GB: 'uint8',
      US: 'uint8',
      UY: 'uint8',
      UZ: 'uint8',
      VU: 'uint8',
      VE: 'uint8',
      VN: 'uint8',
      YE: 'uint8',
      ZM: 'uint8',
      ZW: 'uint8',
    },
  }

  await db.setSchema({
    types: {
      audience: countrySchema,
    },
  })

  const countries = Object.keys(countrySchema.props)

  for (let i = 0; i < 1e6; i++) {
    db.create(
      'audience',
      countries.reduce((obj, code) => {
        obj[code] = Math.floor(Math.random() * 255)
        return obj
      }, {}),
    )
  }
  await perf(async () => {
    await db
      .query('audience')
      .avg(...countries)
      .get()
  }, 'summing 193 props x 1_000_000 nodes')

  for (let i = 1e6 - 1; i >= 1e5; i--) {
    db.delete('audience', i)
  }
  await db.drain()

  await perf(async () => {
    await db
      .query('audience')
      .avg(...countries)
      .get()
  }, 'summing 193 props x 100_000 nodes')

  for (let i = 1e5 - 1; i >= 1e4; i--) {
    db.delete('audience', i)
  }
  await db.drain()

  await perf(async () => {
    await db
      .query('audience')
      .avg(...countries)
      .get()
  }, 'summing 193 props x 10_000 nodes')

  for (let i = 1e4 - 1; i >= 1e3; i--) {
    db.delete('audience', i)
  }
  await db.drain()

  await perf(async () => {
    await db
      .query('audience')
      .avg(...countries)
      .get()
  }, 'summing 193 props x 1_000 nodes')
})
