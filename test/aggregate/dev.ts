import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

// await test('kev', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//     maxModifySize: 1e6,
//   })

//   await db.start({ clean: true })
//   t.after(() => db.stop())

//   await db.setSchema({
//     types: {
//       trip: {
//         driver: 'string',
//         distance: 'int32',
//         rate: 'int8',
//       },
//     },
//   })

//   db.create('trip', { driver: 'lala', distance: 10, rate: 5 })
//   db.create('trip', { driver: 'lala', distance: 20, rate: 10 })
//   db.create('trip', { driver: 'lele', distance: 40, rate: 10 })

//   // console.log((await db.query('trip').include('distance').get()).debug())
//   //   console.log(
//   //     (
//   //       await db.query('trip').harmonicMean('distance').avg('distance').get()
//   //     ).debug(),
//   //   )

//   //   console.log((await db.query('trip').sum('distance', 'rate').get()).debug())
//   console.log(
//     (await db.query('trip').filter('distance', '>', 10).get()).debug(),
//   )
//   console.log(
//     (
//       await db.query('trip').sum('distance').filter('distance', '>', 10).get()
//     ).debug(),
//   )
//   console.log(
//     (
//       await db
//         .query('trip')
//         .sum('distance')
//         .filter('rate', '>', 8)
//         .groupBy('driver')
//         .get()
//     ).debug(),
//   )

//   await db.stop()
// })

// await test('references', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//   })
//   await db.start({ clean: true })
//   t.after(() => db.stop())

//   await db.setSchema({
//     types: {
//       driver: {
//         props: {
//           name: 'string',
//           trips: {
//             items: {
//               ref: 'trip',
//               prop: 'driver', // Defines the inverse relationship
//             },
//           },
//         },
//       },
//       trip: {
//         props: {
//           distance: 'number',
//           rate: 'uint8',
//           driver: {
//             ref: 'driver',
//             prop: 'trips', // Points back to the list on driver
//           },
//         },
//       },
//     },
//   })

//   const d1 = db.create('driver', {
//     name: 'Luc Ferry',
//   })
//   db.drain()
//   const t1 = db.create('trip', {
//     distance: 523.1, // with uint16 => 523
//     rate: 4,
//     driver: d1,
//   })
//   const t2 = db.create('trip', {
//     distance: 1230,
//     rate: 2,
//     driver: d1,
//   })

//   //   await db.query('trip').include('*', '**').get().inspect(10)

//   // await db
//   //   .query('driver')
//   //   .include((t) => t('trips').include('distance'))
//   //   .get()
//   //   .inspect(10)

//   const lala = await db
//     .query('driver')
//     .include((t) =>
//       t('trips')
//         .sum('distance')
//         .avg('distance')
//         .min('rate')
//         .sum('rate')
//         .count(),
//     )
//     .get()

//   // console.log(lala.toObject())
//   lala.inspect(10)
// })

await test('yyy', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      team: {
        props: {
          teamName: { type: 'string' },
          city: { type: 'string' },
          players: {
            items: {
              ref: 'player',
              prop: 'team',
            },
          },
        },
      },
      player: {
        props: {
          playerName: { type: 'string' },
          position: { type: 'string' },
          goalsScored: 'uint16',
          gamesPlayed: 'uint16',
          team: {
            ref: 'team',
            prop: 'players',
          },
        },
      },
    },
  })

  const p1 = db.create('player', {
    playerName: 'Martin',
    position: 'Forward',
    goalsScored: 10,
    gamesPlayed: 5,
  })
  const p2 = db.create('player', {
    playerName: 'Jemerson',
    position: 'Defender',
    goalsScored: 1,
    gamesPlayed: 10,
  })
  const p3 = db.create('player', {
    playerName: 'Pavon',
    position: 'Forward',
    goalsScored: 12,
    gamesPlayed: 6,
  })
  const p4 = db.create('player', {
    playerName: 'Wout',
    position: 'Forward',
    goalsScored: 8,
    gamesPlayed: 7,
  })
  const p5 = db.create('player', {
    playerName: 'Jorrel',
    position: 'Defender',
    goalsScored: 2,
    gamesPlayed: 9,
  })

  const t1 = db.create('team', {
    teamName: 'Grêmio',
    city: 'Porto Alegre',
    players: [p1, p2, p3],
  })
  const t2 = db.create('team', {
    teamName: 'Ajax',
    city: 'Amsterdam',
    players: [p4, p5],
  })
  const t3 = db.create('team', {
    teamName: 'Boca Juniors',
    city: 'Buenos Aires',
    players: [],
  })
  const t4 = db.create('team', {
    teamName: 'Barcelona',
    city: 'Barcelona',
    players: [
      db.create('player', {
        playerName: 'Lewandowski',
        position: 'Forward',
        goalsScored: 5,
        gamesPlayed: 5,
      }),
    ],
  })

  const result = await db
    .query('team')
    .include('teamName', 'city', (select) => {
      select('players').sum('goalsScored', 'gamesPlayed').groupBy('position')
    })
    .get()

  // result.debug()
  // result.inspect()

  deepEqual(
    result.toObject(),
    [
      {
        id: 1,
        teamName: 'Grêmio',
        city: 'Porto Alegre',
        players: {
          Forward: { goalsScored: { sum: 22 }, gamesPlayed: { sum: 11 } }, // Martin (10,5) + Pavon (12,6)
          Defender: { goalsScored: { sum: 1 }, gamesPlayed: { sum: 10 } }, // Jemerson (1,10)
        },
      },
      {
        id: 2,
        teamName: 'Ajax',
        city: 'Amsterdam',
        players: {
          Forward: { goalsScored: { sum: 8 }, gamesPlayed: { sum: 7 } }, // Wout (8,7)
          Defender: { goalsScored: { sum: 2 }, gamesPlayed: { sum: 9 } }, // Jorrel (2,9)
        },
      },
      {
        id: 3,
        teamName: 'Boca Juniors',
        city: 'Buenos Aires',
        players: {}, // does anybody wants to play for Boca?
      },
      {
        id: 4,
        teamName: 'Barcelona',
        city: 'Barcelona',
        players: {
          Forward: { goalsScored: { sum: 5 }, gamesPlayed: { sum: 5 } }, // Lewandowski
        },
      },
    ],
    'Include parent props, with referenced items grouped by their own prop, and aggregations',
  )
})
