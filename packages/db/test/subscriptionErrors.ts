import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { SchemaProp, SchemaType } from '@based/schema'
import { clientWorker } from './shared/startWorker.js'
import { allCountryCodes } from './shared/examples.js'

const countrySchema: SchemaType = {
  props: {
    AL: 'uint8',
    AM: 'uint8',
    AT: 'uint8',
  },
}

const countryCodesArray = Object.keys(countrySchema.props)

await test('subscriptionErrors', async (t) => {
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
        vote: {
          ref: 'vote',
          prop: 'payment',
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

  for (let i = 0; i < 15; i++) {
    await clientWorker(
      t,
      db,
      async (client, { allCountryCodes, countryCodesArray, status, i }) => {
        if (i % 2) {
          client
            .query('vote')
            .filter('fromCountry', '=', ['AE', 'NL'])
            .subscribe((v) => {
              console.log('hello', i)
            })
        }

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
      { allCountryCodes, countryCodesArray, status, i },
    )
  }
})
