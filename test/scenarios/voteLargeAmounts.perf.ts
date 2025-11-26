import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { SchemaProp, SchemaType } from '../../src/schema/index.js'
import { clientWorker } from '../shared/startWorker.js'
import { allCountryCodes } from '../shared/examples.js'
import { wait } from '../../src/utils/index.js'

const NR_VOTES = 7.5e6
const NR_WORKERS = 15
const LOG_INTERVAL = 1e3

const countrySchema: SchemaType = {
  props: {
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
}

const countryCodesArray = Object.keys(countrySchema.props)

await test('schema with many uint8 fields', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const voteCountrySchema: any = countrySchema

  const status = [
    'Requested',
    'ReadyForConfirmationToken',
    'RequestedIntent',
    'ReadyForPaymentIntent',
    'PaymentIntentIsDone',
    'WebhookSuccess',
    'WebhookFailed',
  ]

  await db.setSchema({
    types: {
      payment: {
        fingerprint: 'alias',
        // `seq-cardFingerprint`
        vote: {
          ref: 'vote',
          prop: 'payment',
        },
        confirmationTokenId: 'string',
        paymentIntentId: 'string',
        amount: 'uint32',
        bankCountry: { type: 'string', maxBytes: 2 },
        currency: { type: 'string', maxBytes: 3 },
        status,
        failReason: { type: 'string' },
        errorUserMessage: {
          type: 'string',
        },
        createdAt: {
          type: 'timestamp',
          on: 'create',
        },
      },
      round: {
        votes: {
          items: {
            ref: 'vote',
            prop: 'round',
          },
        },
      },
      vote: {
        fingerprint: {
          type: 'alias',
        },
        fromCountry: { type: 'string', maxBytes: 2 },
        payment: {
          ref: 'payment',
          prop: 'vote',
        },
        round: {
          ref: 'round',
          prop: 'votes',
        },
        countries: voteCountrySchema,
      },
    },
  })

  const final = await db.create('round', {})

  const s = countryCodesArray.map((v) => 'countries.' + v)

  const timeActions = async () => {
    //console.log('\n------ Status ------')
    // await db.query('vote').count().get().inspect()
    // await db.query('payment').count().get().inspect()
    const d = performance.now()
    await db.save()
    const tSave = performance.now() - d
    //console.log('took', tSave.toFixed(2), 'ms to save')

    const cnt = await db.query('vote').count().get()
    // TODO This crashes the test runner if it fails
    //assert(tSave < 1e3) // TODO better assert
    //assert(cnt.execTime < 5)

    //await db
    //  .query('payment')
    //  .include('id')
    //  .filter('status', '=', 'Requested')
    //  .get()
    //  .inspect()

    //console.log(
    //  'group by on all',
    //  (
    //    await db
    //      .query('vote')
    //      .groupBy('fromCountry')
    //      .sum(...s)
    //      .get()
    //  ).execTime.toFixed(2),
    //  'ms',
    //)
    const n = cnt.toObject().count
    const grp = await db
      .query('vote')
      .groupBy('fromCountry')
      .sum(...s)
      .get()
    // TODO This crashes the test runner if it fails
    //assert(grp.execTime < 0.0001115533404 * n + 100)
    process.stderr.write('.')
  }

  let stopped = false
  let timed = async () => {
    await timeActions()
    if (!stopped) {
      int = setTimeout(timed, LOG_INTERVAL)
    }
  }
  let int = setTimeout(timed, LOG_INTERVAL)
  t.after(() => clearInterval(int))

  for (let i = 0; i < NR_WORKERS; i++) {
    await clientWorker(
      t,
      db,
      async (
        client,
        { NR_VOTES, allCountryCodes, countryCodesArray, status },
      ) => {
        const fastPrng = (seed: number = 100) => {
          return (min: number, max: number) => {
            seed = (214013 * seed + 2531011) & 0xffffffff
            return (((seed >> 16) & 0x7fff) % (max - min + 1)) + min
          }
        }
        const prng = fastPrng(~~(Math.random() * 100))

        await client.schemaIsSet()
        client.flushTime = 10
        for (let i = 0; i < NR_VOTES; i++) {
          const payment = client.create('payment', {
            // status: status[prng(0, status.length - 1)],
          })
          const c: any = {}
          for (const key of countryCodesArray) {
            const code = key
            let max = 0
            const p = prng(0, 3)
            max += p
            if (max > 20) {
              break
            }
            c[code] = p
          }
          client.create('vote', {
            payment,
            round: 1,
            fromCountry:
              allCountryCodes[~~(Math.random() * allCountryCodes.length)],
            countries: c,
          })
          if (i % 500 === 0) {
            await client.drain()
          }
        }
        await client.drain()
      },
      {
        NR_VOTES: NR_VOTES / NR_WORKERS,
        allCountryCodes,
        countryCodesArray,
        status,
      },
    )
  }

  stopped = true
  clearTimeout(int)
  await wait(1000)

  await timeActions()
  await wait(1000)
  process.stderr.write('\n')
})
