import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { SchemaProp, SchemaType } from '@based/schema'
import { deepEqual } from './shared/assert.js'
import { inspect } from 'util'

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

await test('vote including round', async (t) => {
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

const testVotes = (opts: { votes: any; amount: number }) => {
  return test(`vote single ref test remove ${inspect(opts)}`, async (t) => {
    const db = new BasedDb({
      path: t.tmp,
    })
    await db.start({ clean: true })
    t.after(() => t.backup(db))

    await db.setSchema({
      types: {
        round: {
          votes: {
            items: {
              ref: 'vote',
              prop: 'round',
            },
          },
        },
        vote: {
          derp: 'uint16',
          round: {
            ref: 'round',
            prop: 'votes',
          },
        },
      },
    })

    let amount = opts.amount

    const final = await db.create('round')

    for (let i = 0; i < amount; i++) {
      db.create('vote', {
        round: final,
      })
    }

    console.log(`Creating votes (${amount})ms`, await db.drain())

    console.log('Remove votes from final')
    await db.update('round', final, {
      votes: opts.votes,
    })

    deepEqual(
      (await db.query('round', final).include('votes').get().toObject()).votes
        .length,
      0,
      'clear refs',
    )

    const len = amount === 1 ? 1 : Math.ceil(amount * 0.01)
    for (let i = 0; i < len; i++) {
      const randomId = amount === 1 ? 1 : Math.ceil(Math.random() * amount)
      deepEqual(
        await db.query('vote', randomId).include('round').get(),
        { id: randomId, round: null },
        `clears refs on the other side ${randomId}`,
      )
    }

    const votes = await db
      .query('vote')
      .range(0, 1e6)
      .include('id')
      .get()
      .toObject()
    let i = votes.length - 1
    for (i = 0; i < votes.length; i++) {
      db.delete('vote', votes[i].id)
    }

    console.log(
      'Total db time removing all votes (refs in round)',
      await db.drain(),
    )
  })
}

await testVotes({ votes: null, amount: 1e6 })
await testVotes({ votes: [], amount: 1e6 })
// await testVotes({ votes: null, amount: 1000 })
// await testVotes({ votes: [1], amount: 1000 })
