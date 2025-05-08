import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { wait } from '@saulx/utils'
import { SchemaProp, SchemaType } from '@based/schema'
import { clientWorker } from './shared/startWorker.js'

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
  t.after(() => db.destroy())

  const voteCountrySchema: SchemaProp = countrySchema

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
        status: [
          'Requested',
          'ReadyForConfirmationToken',
          'RequestedIntent',
          // paymentStatusTime(ID TOKEN)
          // SUB THAT IS ALSO ON THE FRONT END.getWhen(v => v.status == ReadyForPayment)
          'ReadyForPaymentIntent',
          'PaymentIntentIsDone',
          'WebhookSuccess',
          'WebhookFailed',
        ],
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
  console.log({ final })

  const int = setInterval(async () => {
    // await db.query('vote').count().get().inspect()
    // await db.query('payment').count().get().inspect()
    await db.query('vote').count().get().inspect()
  }, 1e3)
  t.after(() => clearInterval(int))

  for (let i = 0; i < 10; i++) {
    await clientWorker(t, db, async (client) => {
      client.flushTime = 0
      for (let i = 0; i < 1e4; i++) {
        for (let j = 0; j < 100; j++) {
          const payment = client.create('payment', {})
          client.create('vote', {
            payment,
            round: 1,
          })
        }
        await client.drain()
      }
    })
  }

  await db.query('vote').count().get().inspect()
})
