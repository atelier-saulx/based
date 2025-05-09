import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { SchemaProp, SchemaType } from '@based/schema'
import { clientWorker } from './shared/startWorker.js'
import { allCountryCodes } from './shared/examples.js'
import { wait } from '@saulx/utils'

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

  const voteCountrySchema: SchemaProp = countrySchema

  const status = [
    'Requested',
    'ReadyForConfirmationToken',
    'RequestedIntent',
    // paymentStatusTime(ID TOKEN)
    // SUB THAT IS ALSO ON THE FRONT END.getWhen(v => v.status == ReadyForPayment)
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
  console.log({ final, countryCodesArray })

  const s = countryCodesArray.map((v) => 'countries.' + v)

  const timeActions = async () => {
    console.log('\n----------------------Logging interval')
    // await db.query('vote').count().get().inspect()
    // await db.query('payment').count().get().inspect()
    const d = performance.now()
    await db.save()
    console.log('took', performance.now() - d, 'ms to save')

    await db.query('vote').count().get().inspect()

    await db
      .query('payment')
      .include('id')
      .filter('status', '=', 'Requested')
      .get()
      .inspect()

    console.log(
      'group by on all',
      (await db.query('vote').groupBy('fromCountry').sum(s).get()).execTime,
      'ms',
    )
  }

  let stopped = false
  let timed = async () => {
    await timeActions()
    if (!stopped) {
      int = setTimeout(timed, 1e3)
    }
  }
  let int = setTimeout(timed, 1e3)
  t.after(() => clearInterval(int))

  for (let i = 0; i < 15; i++) {
    await clientWorker(
      t,
      db,
      async (client, { allCountryCodes, countryCodesArray, status }) => {
        client.flushTime = 0
        for (let i = 0; i < 1e4; i++) {
          const payment = client.create('payment', {
            // status: status[~~(Math.random() * status.length)],
          })
          const c: any = {}
          for (const key of countryCodesArray) {
            const code = key
            let max = 0
            const p = ~~(Math.random() * 3)
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
      { allCountryCodes, countryCodesArray, status },
    )
  }

  stopped = true
  clearTimeout(int)
  await wait(1000)

  await timeActions()
  await wait(1000)
})
