import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'

await test('votesEdges', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    // debug: 'server',
    // maxModifySize: 1000 * 1000 * 10,
    // maxModifySize: 1000 * 1000 * 1000,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      payment: {
        vote: {
          ref: 'vote',
          prop: 'payment',
        },
      },
      contestant: {},
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
        contestant: {
          ref: 'contestant',
          prop: 'votes',
        },
        // contestants: {
        //   items: {
        //     ref: 'contestant',
        //     prop: 'votes',
        //     // $votes: 'uint8',
        //   },
        // },
      },
    },
  })

  const final = await db.create('round')

  const amount = 1e6

  const contestants = []
  for (let i = 0; i < 20; i++) {
    contestants.push(await db.create('contestant'))
  }

  await db.drain()

  const voteData: any = {
    round: final,
  }
  for (let i = 1; i <= 20; i++) {
    // voteData.ddi[`ddi${i}`] = i % 256
  }

  let d = performance.now()
  for (let j = 1; j <= amount; j++) {
    const payment = db.create('payment')
    voteData.payment = payment
    voteData.fingerprint = `f${j}-${final}`
    const artist = contestants[j % 20]
    // voteData.contestants = [
    // {
    // id: artist,
    // $votes: 8,
    // },
    // ]
    // voteData.contestant = artist
    db.create('vote', voteData)
  }

  await db.drain()
  console.log(`Create ${amount} votes`, performance.now() - d, 'ms')

  let a = 0
  const has = new Set()
  d = performance.now()
  for (let j = amount - 1; j > 0; j--) {
    const artist = contestants[j % 20]
    const randId = ~~(Math.random() * amount) + 1
    a = randId
    if (!has.has(randId)) {
      // from 200 to 4000
      has.add(randId)
      db.update('vote', randId, {
        contestant: artist,
      })
    } else {
      a++
    }
  }

  await db.drain()
  console.log(
    `Update random order id ${amount} votes`,
    performance.now() - d,
    'ms',
    a,
  )

  await db.query('vote').get().inspect(1)
  await db.query('round', final).include('*', '**').get().inspect(1)
})
