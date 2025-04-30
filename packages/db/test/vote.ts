import { get } from 'http'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { wait } from '@saulx/utils'
import { SchemaProp } from '@based/schema'
import { allCountryCodes } from './shared/examples.js'

await test('schema with many uint8 fields', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    // debug: 'server',
    maxModifySize: 1000 * 1000 * 10,
    // maxModifySize: 1000 * 1000 * 1000,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const maxPaymentsPerHub = 200
  const maxHubs = 10
  const timeUint = 10
  const maxConfirmations = 95000
  const maxIntents = 60000

  const voteCountrySchema: SchemaProp = {
    type: 'object',
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

  const final = await db.create('round')

  let jobTimer
  let totalPayments = 0
  let allPaymentsDone = false
  const queueJob = async () => {
    const confirmation = async () => {
      console.log('go query1')

      const rdyForConfirmationToken = await db
        .query('round', final)
        .include((select) => {
          const t = select('payments')
          t.filter('status', '=', ['Requested'])
          t.range(0, maxConfirmations)
          t.include(['status'])
        })
        .get()

      const r = rdyForConfirmationToken.toObject().payments
      for (const payment of r) {
        db.update('payment', payment.id, {
          status: 'ReadyForConfirmationToken',
        })
      }
      return r.length
    }

    const paymentIntent = async () => {
      console.log('go query')
      const rdyForPaymentIntent = await db
        .query('round', final)
        .include((select) => {
          const t = select('payments')
          t.filter('status', '=', ['RequestedIntent'])
          t.range(0, maxIntents)
          t.include(['status'])
        })
        .get()
      const r = rdyForPaymentIntent.toObject().payments
      for (const payment of r) {
        db.update('payment', payment.id, {
          status: 'ReadyForPaymentIntent',
        })
      }
      return r.length
    }

    const d = Date.now()
    const [cl, pl] = await Promise.all([confirmation(), paymentIntent()])
    const diff = Date.now() - d

    if (cl || pl) {
      console.log(
        'total',
        totalPayments,
        'JOB - Set',
        cl,
        'to ReadyForConfirmationToken and',
        pl,
        'to ReadyForPaymentIntent',
      )
    } else {
      allPaymentsDone = true
    }

    jobTimer = setTimeout(
      () => {
        queueJob()
      },
      Math.max(0, timeUint - diff),
    )
  }

  setTimeout(queueJob, 100)

  const fakeWebHooks = async (meta: any) => {
    await wait(Math.random() * timeUint)
    // console.log('Recevied webhook!', meta)

    const payment = meta.id
    db.update('payment', payment, {
      status: 'WebhookSuccess',
    })

    // HUB CODE
    const voteData: any = {
      // ddi: {},
      round: final,
      countries: meta.countries,
    }

    voteData.fromCountry =
      allCountryCodes[~~(Math.random() * allCountryCodes.length)]
    voteData.payment = payment
    voteData.fingerprint = `fingerprint-for-you-${payment}-${final}`
    const voteId = db.create('vote', voteData)
  }

  const updatePayment = async (v: any) => {
    if (v.status === 'ReadyForConfirmationToken') {
      await wait(Math.random() * timeUint)

      db.update('payment', v.id, {
        status: 'RequestedIntent',
        confirmationTokenId: '12345678901234567890123456789012',
      })
    } else if (v.status === 'ReadyForPaymentIntent') {
      //
      db.update('payment', v.id, {
        status: 'PaymentIntentIsDone',
        confirmationTokenId: '12345678901234567890123456789012',
      })

      // HAS TO BE PASS IN META
      const countries = {}
      let totalVotes = 0
      for (const country in voteCountrySchema.props) {
        const v = ~~(Math.random() * 5)
        totalVotes += v
        if (totalVotes > 20) {
          break
        }
        countries[country] = v
      }
      // could pass stuff in meta this is the meta!
      fakeWebHooks({ id: v.id, countries })
    }
  }

  const startHub = (hubName: number) => {
    const blockThings = new Set()
    const ids: Map<number, (bla: any) => void> = new Map()

    const subscribeToPayment = (id) => {
      ids.set(id, (v) => {
        if (!blockThings.has(id)) {
          blockThings.add(id)
          updatePayment(v).then(() => {
            blockThings.delete(id)
          })
        }
      })
    }

    const getStuff = async () => {
      const realIds = [...ids.keys()]
      const myThings = await db
        .query('payment', realIds)
        .filter('status', '=', [
          'ReadyForConfirmationToken',
          'ReadyForPaymentIntent',
          'WebhookSuccess',
          'WebhookFailed',
        ])
        .include(['status'])
        .get()

      for (const thing of myThings) {
        const listener = ids.get(thing.id)
        if (!listener) {
          console.error('sus...')
        } else {
          listener(thing)
          if (
            thing.status === 'WebhookSuccess' ||
            thing.status === 'WebhookFailed'
          ) {
            ids.delete(thing.id)
          }
        }
      }
      setTimeout(getStuff, timeUint * 0.5)
    }
    getStuff()

    const createPayment = async () => {
      totalPayments++
      subscribeToPayment(
        await db.create('payment', {
          // fingerprint: `fingerprint-for-you-${j}-${final}`,
          // confirmationTokenId: '12345678901234567890123456789012',
          // paymentIntentId: '12345678901234567890123456789012',
          // bankCountry: 'de',
          // currency: 'EUR',
          // amount: 100,
          round: final,
          status: 'Requested',
        }),
      )
    }

    let i = 0
    const makePayments = () => {
      const len = ~~(Math.random() * maxPaymentsPerHub)
      // console.log('make', len, 'payments on hub', hubName)
      for (let i = 0; i < len; i++) {
        createPayment()
      }
      i++
      if (i < 20) {
        setTimeout(makePayments, timeUint)
      }
    }

    makePayments()
  }

  for (let i = 0; i < maxHubs; i++) {
    startHub(i)
  }

  const bla = async () => {
    if (allPaymentsDone) {
      return true
    } else {
      await wait(timeUint * 2)
    }
    return bla()
  }

  await bla()
  clearTimeout(jobTimer)

  await db.query('vote').range(0, 1e3).get().inspect()

  await wait(1e3)
})
