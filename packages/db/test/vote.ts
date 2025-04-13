import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('schema with many uint8 fields', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    // debug: 'server',
    maxModifySize: 1000 * 1000 * 10,
    // maxModifySize: 1000 * 1000 * 1000,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

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
        fingerprint: {
          type: 'alias',
          required: true,
          // `${paymentFingerprint}-${roundId}`
          //   validation: (v) => {
          //     return /^[a-zA-Z0-9-_]+-[0-9]+$/.test(v)
          //   },
        },
        bankFingerprint: {
          type: 'alias',
          required: true,
          // `${paymentFingerprint}-${roundId}`
          //   validation: (v) => {
          //     return /^[a-zA-Z0-9-_]+-[0-9]+$/.test(v)
          //   },
        },
        payment: {
          ref: 'payment',
          prop: 'vote',
          required: true,
        },
        round: {
          ref: 'round',
          prop: 'votes',
          required: true,
        },
        ddi: {
          props: {
            ddi1: 'uint8',
            ddi2: 'uint8',
            ddi3: 'uint8',
            ddi4: 'uint8',
            ddi5: 'uint8',
            ddi6: 'uint8',
            ddi7: 'uint8',
            ddi8: 'uint8',
            ddi9: 'uint8',
            ddi10: 'uint8',
            ddi11: 'uint8',
            ddi12: 'uint8',
            ddi13: 'uint8',
            ddi14: 'uint8',
            ddi15: 'uint8',
            ddi16: 'uint8',
            ddi17: 'uint8',
            ddi18: 'uint8',
            ddi19: 'uint8',
            ddi20: 'uint8',
          },
        },
      },
    },
  })

  const final = await db.create('round')

  const amount = 1e5
  console.info('--------------------------------')
  let d = performance.now()

  const voteData: any = {
    ddi: {},
    round: final,
  }
  for (let i = 1; i <= 20; i++) {
    voteData.ddi[`ddi${i}`] = i % 256
  }

  for (let j = 1; j <= amount; j++) {
    const payment = db.create('payment')
    voteData.payment = payment
    voteData.fingerprint = `f${j}-${final}`
    const voteId = db.create('vote', voteData)
    await db.drain()
  }

  await db.drain()
  console.log(`Create ${amount} votes`, performance.now() - d, 'ms')

  //   await db.query('vote').get().inspect(1)

  //   await db.query('round', final).include('*', '**').get().inspect(1)
})
