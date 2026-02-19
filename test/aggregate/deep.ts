/*
 * Deep = Reference(s), Edges and nests
 */
import { equal } from 'node:assert'
import { BasedDb } from '../../src/index.js'
import { allCountryCodes } from '../shared/examples.js'
import test from '../shared/test.js'
import { throws, deepEqual } from '../shared/assert.js'
import { fastPrng } from '../../src/utils/index.js'

await test('sum branched includes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      sequence: {
        props: {
          votes: {
            items: {
              ref: 'vote',
              prop: 'sequence',
            },
          },
        },
      },
      vote: {
        props: {
          sequence: {
            ref: 'sequence',
            prop: 'votes',
          },
          flap: {
            props: {
              hello: 'uint32',
            },
          },
          country: { type: 'string' },
          AU: 'uint8',
          NL: 'uint8',
        },
      },
    },
  })
  const nl1 = db.create('vote', {
    country: 'bb',
    flap: { hello: 100 },
    NL: 10,
  })
  const nl2 = db.create('vote', {
    country: 'aa',
    NL: 20,
  })
  const au1 = db.create('vote', {
    country: 'aa',
    AU: 15,
  })
  const s = db.create('sequence', { votes: [nl1, nl2, au1] })

  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').sum('NL', 'AU')
      })
      .get()
      .toObject(),
    [{ id: 1, votes: { NL: { sum: 30 }, AU: { sum: 15 } } }],
    'brached include, sum, references',
  )

  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').groupBy('country').sum('NL', 'AU')
      })
      .get()
      .toObject(),
    [
      {
        id: 1,
        votes: {
          aa: { AU: { sum: 15 }, NL: { sum: 20 } },
          bb: { AU: { sum: 0 }, NL: { sum: 10 } },
        },
      },
    ],
    'branched include, references, groupBy',
  )

  // deepEqual(
  //   await db
  //     .query('sequence')
  //     .include((select) => {
  //       select('votes').filter('country', '=', 'aa').sum('NL', 'AU') // string filter not implemented and also filter in refs group not implemented
  //     })
  //     .get()
  //     .toObject(),
  //   [{ id: 1, votes: { NL: { sum: 20 }, AU: { sum: 15 } } }],
  //   'branched include, references, filtered, groupBy',
  // )
})

await test('count branched includes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      sequence: {
        props: {
          votes: {
            items: {
              ref: 'vote',
              prop: 'sequence',
            },
          },
        },
      },
      vote: {
        props: {
          sequence: {
            ref: 'sequence',
            prop: 'votes',
          },
          flap: {
            props: {
              hello: 'uint32',
            },
          },
          country: { type: 'string' },
          AU: 'uint8',
          NL: 'uint8',
        },
      },
    },
  })
  const nl1 = db.create('vote', {
    country: 'bb',
    flap: { hello: 100 },
    NL: 10,
  })
  const nl2 = db.create('vote', {
    country: 'aa',
    NL: 20,
  })
  const au1 = db.create('vote', {
    country: 'aa',
    AU: 15,
  })
  const s = db.create('sequence', { votes: [nl1, nl2, au1] })

  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').count()
      })
      .get()
      .toObject(),
    [{ id: 1, votes: { count: 3 } }],
    'brached include, count, references',
  )

  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').groupBy('country').sum('NL', 'AU')
      })
      .get()
      .toObject(),
    [
      {
        id: 1,
        votes: {
          aa: { AU: { sum: 15 }, NL: { sum: 20 } },
          bb: { AU: { sum: 0 }, NL: { sum: 10 } },
        },
      },
    ],
    'branched include, references, groupBy',
  )

  // deepEqual(
  //   await db
  //     .query('sequence')
  //     .include((select) => {
  //       select('votes').filter('country', '=', 'aa').count() // string filter not implemented and also filter in refs group not implemented
  //     })
  //     .get()
  //     .toObject(),
  //   [{ id: 1, votes: { count: 2 } }],
  //   'count, branched include, references, filtered',
  // )
})

await test('agg on references', async (t) => {
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

  db.drain()

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
      select('players').groupBy('position').sum('goalsScored', 'gamesPlayed')
    })
    .get()

  deepEqual(
    result.toObject(),
    [
      {
        id: 1,
        teamName: 'Boca Juniors',
        city: 'Buenos Aires',
        players: {}, // does anybody wants to play for Boca?
      },
      {
        id: 2,
        teamName: 'Barcelona',
        city: 'Barcelona',
        players: {
          Forward: { goalsScored: { sum: 5 }, gamesPlayed: { sum: 5 } }, // Lewandowski
        },
      },
      {
        id: 3,
        teamName: 'Grêmio',
        city: 'Porto Alegre',
        players: {
          Forward: { goalsScored: { sum: 22 }, gamesPlayed: { sum: 11 } }, // Martin (10,5) + Pavon (12,6)
          Defender: { goalsScored: { sum: 1 }, gamesPlayed: { sum: 10 } }, // Jemerson (1,10)
        },
      },
      {
        id: 4,
        teamName: 'Ajax',
        city: 'Amsterdam',
        players: {
          Forward: { goalsScored: { sum: 8 }, gamesPlayed: { sum: 7 } }, // Wout (8,7)
          Defender: { goalsScored: { sum: 2 }, gamesPlayed: { sum: 9 } }, // Jorrel (2,9)
        },
      },
    ],
    'Include parent props, with referenced items grouped by their own prop, and aggregations',
  )
})

await test('enums', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  const types = ['IPA', 'Lager', 'Ale', 'Stout', 'Wit', 'Dunkel', 'Tripel']
  await db.setSchema({
    types: {
      beer: {
        props: {
          name: 'string',
          type: types,
          price: 'number',
          bitterness: 'number',
          alchol: 'number',
          year: 'uint16',
        },
      },
    },
  })

  const b1 = await db.create('beer', {
    name: "Brouwerij 't IJwit",
    type: 'Wit',
    price: 7.2,
    alchol: 6.5,
    year: 1985,
  })
  const b2 = await db.create('beer', {
    name: 'De Garre Triple Ale',
    type: 'Tripel',
    price: 11.5,
    alchol: 11.0,
    year: 1986,
  })

  const b3 = await db.create('beer', {
    name: 'Gulden Draak',
    type: 'Tripel',
    price: 12.2,
    alchol: 10.0,
    year: 1795,
  })

  deepEqual(
    await db.query('beer').avg('price').groupBy('type').get().toObject(),
    {
      Tripel: {
        price: { avg: 11.85 },
      },
      Wit: {
        price: { avg: 7.2 },
      },
    },
    'group by enum in main',
  )

  deepEqual(
    await db.query('beer').hmean('price').groupBy('type').get().toObject(),
    {
      Tripel: {
        price: { hmean: 11.839662447257384 },
      },
      Wit: {
        price: { hmean: 7.199999999999999 }, // 7.2 should be approximated
      },
    },
    'hmean by enum in main',
  )
})

await test.skip('refs with enums ', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      movie: {
        name: 'string',
        genre: ['Comedy', 'Thriller', 'Drama', 'Crime'],
        actors: {
          items: {
            ref: 'actor',
            prop: 'actor',
          },
        },
      },
      actor: {
        name: 'string',
        movies: {
          items: {
            ref: 'movie',
            prop: 'movie',
          },
        },
      },
    },
  })

  const m1 = await db.create('movie', {
    name: 'Kill Bill',
    genre: 'Crime',
  })
  const m2 = await db.create('movie', {
    name: 'Pulp Fiction',
    genre: 'Crime',
  })
  const a1 = db.create('actor', { name: 'Uma Thurman', movies: [m1, m2] })
  const a2 = db.create('actor', { name: 'Jonh Travolta', movies: [m2] })

  deepEqual(
    await db
      .query('actor')
      .include((q) => q('movies').groupBy('genre').count())
      .get()
      .toObject(),
    [
      {
        id: 1,
        movies: {
          Crime: {
            count: 2,
          },
        },
      },
      {
        id: 2,
        movies: {
          Crime: {
            count: 1,
          },
        },
      },
    ],
    'count group by enum in refs',
  )
})

await test('cardinality', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      lunch: {
        week: 'string',
        lala: 'number',
        lele: 'number',
        Mon: {
          type: 'cardinality',
          precision: 12,
        },
        Tue: 'cardinality',
        Wed: 'cardinality',
        Thu: 'cardinality',
        Fri: 'cardinality',
      },
    },
  })

  const week27 = {
    week: '27',
    lala: 250,
    Mon: ['Tom', 'youzi', 'jimdebeer', 'Victor', 'Luca'],
    Tue: ['Nuno', 'Tom', 'Alex', 'Niels', 'jimdebeer', 'Francesco', 'Victor'],
    Wed: ['Nuno', 'youzi', 'Francesco', 'Victor', 'Luca'],
    Thu: [
      'Nuno',
      'yves',
      'Fulco',
      'Tom',
      'Sara',
      'Felix',
      'Thomas',
      'Sebastian',
      'jimdebeer',
      'youzi',
      'Francesco',
      'Victor',
      'sandor',
      'Fabio',
      'Luca',
    ],
    Fri: [
      'Nuno',
      'yves',
      'Tom',
      'youzi',
      'jimdebeer',
      'Francesco',
      'Victor',
      'sandor',
      'Luca',
    ],
  }
  await db.create('lunch', week27)
  await db.create('lunch', {
    week: '28',
    Mon: ['youzi', 'Marco', 'Luigui'],
    lala: 10,
  })

  deepEqual(
    await db.query('lunch').cardinality('Mon').get().toObject(),
    { Mon: { cardinality: 7 } },
    'main cardinality no group by',
  )

  deepEqual(
    await db.query('lunch').cardinality('Mon').groupBy('week').get().toObject(),
    {
      27: {
        Mon: { cardinality: 5 },
      },
      28: {
        Mon: { cardinality: 3 },
      },
    },
    'cardinality main groupBy',
  )
})

await test('cardinality on references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      booth: {
        company: 'string',
        // badgesScanned: 'number',
        badgesScanned: 'cardinality',
      },
      fair: {
        day: 'timestamp',
        booths: {
          items: {
            ref: 'booth',
            prop: 'booth',
          },
        },
      },
    },
  })

  const bg = db.create('booth', {
    company: 'big one',
    badgesScanned: ['engineer 1', 'salesman', 'spy', 'annonymous'],
  })
  const stp = db.create('booth', {
    company: 'just another startup',
    badgesScanned: ['nice ceo', 'entusiastic dev'],
  })
  db.create('fair', {
    day: new Date('08/02/2024'),
    booths: [bg, stp],
  })

  deepEqual(
    await db
      .query('fair')
      .include((s) => s('booths').cardinality('badgesScanned'))
      .get(),
    [
      {
        id: 1,
        booths: {
          badgesScanned: {
            cardinality: 6,
          },
        },
      },
    ],
    'branched query with cardinality function',
  )

  /*
   *  Nested syntax:
   */

  // await db.query('fair').include('booths.badgesScanned').get().inspect()

  // await db
  //   .query('fair')
  //   .cardinality('booths.badgesScanned')
  //   .groupBy('day')
  //   .get()
  //   .inspect()
})

await test('group by reference ids', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      trip: {
        pickup: 'timestamp',
        dropoff: 'timestamp',
        distance: 'number',
        vehicle: {
          ref: 'vehicle',
          prop: 'vehicle',
        },
      },
      driver: {
        name: 'string',
        rank: 'int8',
        trips: {
          items: {
            ref: 'trip',
            prop: 'trip',
          },
        },
        vehicle: {
          ref: 'vehicle',
          prop: 'car',
        },
      },
      vehicle: {
        plate: 'string',
        model: 'string',
        year: 'number',
      },
    },
  })
  const v1 = db.create('vehicle', {
    plate: 'DVH0101',
    model: 'BYD 01',
    year: 2024,
  })
  const v2 = db.create('vehicle', {
    plate: 'MBT8965',
    model: 'VW Beatle',
    year: 1989,
  })
  const t1 = db.create('trip', {
    distance: 523.1,
    vehicle: v2,
  })
  const d1 = db.create('driver', {
    name: 'Luc Ferry',
    rank: 5,
    vehicle: v2,
    trips: [t1],
  })

  deepEqual(
    await db.query('driver').sum('rank').groupBy('vehicle').get().toObject(),
    {
      2: {
        rank: { sum: 5 },
      },
    },
    'group by reference id',
  )

  deepEqual(
    await db
      .query('driver')
      .include((q) => q('trips').groupBy('vehicle').max('distance'))
      .include('*')
      .get()
      .toObject(),
    [
      {
        id: 1,
        rank: 5,
        name: 'Luc Ferry',
        trips: {
          2: {
            distance: { max: 523.1 },
          },
        },
      },
    ],
    'branched query with nested group by reference id',
  )
})

await test.skip('nested references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          strong: 'uint16',
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
            },
          },
        },
      },
    },
  })

  const bob = db.create('user', {
    name: 'bob',
    strong: 1,
  })

  const marie = db.create('user', {
    name: 'marie',
    strong: 2,
  })

  const john = db.create('user', {
    name: 'john',
    friends: [bob, marie],
    strong: 4,
  })

  // await db.query('user').include('*', '**').get().inspect(10)

  deepEqual(
    await db.query('user').sum('friends.strong').get().toObject(),
    {
      strong: {
        sum: 7,
      },
    },
    'nested references access with dot sintax',
  )
})

await test.skip('edges aggregation', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      movie: {
        name: 'string',
        genre: ['Comedy', 'Thriller', 'Drama', 'Crime'],
        actors: {
          items: {
            ref: 'actor',
            prop: 'movies',
            $rating: 'uint16',
            $hating: 'uint16',
          },
        },
      },
      actor: {
        name: 'string',
        strong: 'uint16',
        strong2: 'uint16',
        movies: {
          items: {
            ref: 'movie',
            prop: 'actors',
          },
        },
      },
    },
  })

  const a1 = db.create('actor', {
    name: 'Uma Thurman',
    strong: 10,
    strong2: 80,
  })
  const a2 = db.create('actor', {
    name: 'Jonh Travolta',
    strong: 5,
    strong2: 40,
  })

  const m1 = await db.create('movie', {
    name: 'Kill Bill',
    actors: [
      {
        id: a1,
        $rating: 55,
        $hating: 5,
      },
    ],
  })
  const m2 = await db.create('movie', {
    name: 'Pulp Fiction',
    actors: [
      {
        id: a1,
        $rating: 63,
        $hating: 7,
      },
      {
        id: a2,
        $rating: 77,
        $hating: 3,
      },
    ],
  })

  // await db
  //   .query('movie')
  //   .include('*', '**')
  //   // .include('actors.$rating')
  //   // .include('actors.name')
  //   .get()
  //   .inspect(10, true)

  /*---------------------------*/
  /*       NESTED SINTAX       */
  /*---------------------------*/

  // before: NOK: crash
  // after: NOK: unreacheable
  // console.log(
  //   JSON.stringify(
  //     await db.query('movie').include('actors.strong').get().toObject(),
  //   ),
  // )

  // before: NOK: error in js: Cannot read properties of undefined (reading 'edges')
  // after: NOK: zeroing
  // await db.query('movie').include('actors.$rating').get().inspect(10)

  /*----------------------------*/
  /*       BRANCHED QUERY       */
  /*----------------------------*/

  // await db
  //   .query('movie')
  //   .include((q) => q('actors').max('strong').sum('strong2'))
  //   .get()
  //   .inspect(10)

  // deepEqual(
  //   await db
  //     .query('movie')
  //     .include((q) => q('actors').max('$rating'))
  //     .get()
  //     .toObject(),
  //   [
  //     {
  //       id: 1,
  //       actors: {
  //         $rating: {
  //           max: 55,
  //         },
  //       },
  //     },
  //     {
  //       id: 2,
  //       actors: {
  //         $rating: {
  //           max: 77,
  //         },
  //       },
  //     },
  //   ],
  //   'single edge aggregation, branched query',
  // )

  // deepEqual(
  //   await db
  //     .query('movie')
  //     .include((q) => q('actors').max('$rating').sum('$hating'))
  //     .get()
  //     .toObject(),
  //   [
  //     {
  //       id: 1,
  //       actors: {
  //         $rating: {
  //           max: 55,
  //         },
  //         $hating: {
  //           sum: 5,
  //         },
  //       },
  //     },
  //     {
  //       id: 2,
  //       actors: {
  //         $rating: {
  //           max: 77,
  //         },
  //         $hating: {
  //           sum: 10,
  //         },
  //       },
  //     },
  //   ],
  //   'multiple edges with multiple agg functions, branched query',
  // )

  // deepEqual(
  //   await db
  //     .query('movie')
  //     .include((q) => q('actors').max('$rating', '$hating'))
  //     .get()
  //     .toObject(),
  //   [
  //     {
  //       id: 1,
  //       actors: {
  //         $rating: {
  //           max: 55,
  //         },
  //         $hating: {
  //           max: 5,
  //         },
  //       },
  //     },
  //     {
  //       id: 2,
  //       actors: {
  //         $rating: {
  //           max: 77,
  //         },
  //         $hating: {
  //           max: 7,
  //         },
  //       },
  //     },
  //   ],
  //   'multiple edges on same agg function, branched query',
  // )

  /*-----------------------------------*/
  /*          STRAIGHT ON TYPE         */
  /*-----------------------------------*/
  // before: OK: error in js: Cannot read properties of undefined (reading 'edges')
  // after: NOK: feature not implemented
  // await db.query('actor').max('$rating').get().inspect(10)
  // await db.query('actor').sum('strong').get().inspect(10) // this is OK, summing all strong props in the type actor
})
