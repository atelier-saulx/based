import { get } from 'http'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { wait } from '@saulx/utils'
import { SchemaProp, SchemaType } from '@based/schema'
import { allCountryCodes } from './shared/examples.js'

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

  await db.setSchema({
    types: {
      payment: {
        fingerprint: 'alias',
        // `seq-cardFingerprint`
        vote: {
          ref: 'vote',
          prop: 'payment',
        },
        round: {
          ref: 'round',
          prop: 'payments',
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
        payments: {
          items: {
            ref: 'payment',
            prop: 'round',
          },
        },
      },
      vote: {
        fingerprint: {
          type: 'alias',
        },
        // `seq-cardPar`
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
  for (let i = 0; i < 3e5; i++) {
    const payment = db.create('payment', {
      fingerprint: `blablabla-${i}`,
      status: 'WebhookSuccess',
      round: final,
    })
    const vote = db.create('vote', {
      fingerprint: `blablabla-vote-${i}`,
      payment,
      round: final,
    })
  }
  await db.save()
  console.log('set all items', await db.drain())
})

await test('vote single ref only remove', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const voteCountrySchema: SchemaProp = countrySchema

  await db.setSchema({
    types: {
      payment: {
        fingerprint: 'alias',
        vote: {
          ref: 'vote',
          prop: 'payment',
        },
        createdAt: {
          type: 'timestamp',
          on: 'create',
        },
        status: [
          'Requested',
          'ReadyForConfirmationToken',
          'RequestedIntent',
          'ReadyForPaymentIntent',
          'PaymentIntentIsDone',
          'WebhookSuccess',
          'WebhookFailed',
        ],
      },
      vote: {
        fingerprint: {
          type: 'alias',
        },
        cardGeo: { type: 'string', maxBytes: 2 },
        payment: {
          ref: 'payment',
          prop: 'vote',
        },
        countries: voteCountrySchema,
      },
    },
  })

  for (let i = 0; i < 1e3; i++) {
    for (let j = 0; j < 1e3; j++) {
      const id = db.create('payment', {
        status: 'WebhookSuccess',
        fingerprint: `derpderp-${j}-${i}`,
      })
      const cardGeo =
        allCountryCodes[~~(Math.random() * allCountryCodes.length)]
      const c: any = {}
      let max = 0
      for (const key of countryCodesArray) {
        const code = key
        if (code === cardGeo) {
          continue
        }
        const p = ~~(Math.random() * 3)
        max += p
        if (max > 20) {
          break
        }
        c[code] = p
      }
      db.create('vote', {
        cardGeo,
        payment: id,
        fingerprint: `derp-${j}-${i}`,
        countries: c,
      })
    }
    await wait(1)
  }

  console.log('Total db time (1000x 1000x) x2', await db.drain())

  const votes = await db.query('vote').range(0, 1e6).include('id').get()
  for (const vote of votes) {
    db.delete('vote', vote.id)
  }

  const payments = await db.query('payment').range(0, 1e6).include('id').get()
  for (const payment of payments) {
    db.delete('payment', payment.id)
  }

  console.log('Total db time removing all', await db.drain())
})
