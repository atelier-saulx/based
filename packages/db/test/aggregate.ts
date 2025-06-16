import { equal } from 'node:assert'
import { BasedDb } from '../src/index.js'
import { allCountryCodes } from './shared/examples.js'
import test from './shared/test.js'
import { throws, deepEqual } from './shared/assert.js'

await test('sum top level', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

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

  // top level  ----------------------------------
  deepEqual(
    await db.query('vote').sum('NL').get().toObject(),
    { NL: 30 },
    'sum, top level, single prop',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'aa')
      .sum('NL')
      .get()
      .toObject(),
    { NL: 20 },
    'sum with filter',
  )

  deepEqual(
    await db.query('vote').sum('NL', 'AU').get().toObject(),
    { NL: 30, AU: 15 },
    'sum, top level, multiple props',
  )

  throws(async () => {
    await db.query('vote').sum().get().toObject()
  }, 'sum() returning nothing')

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'zz')
      .sum('NL')
      .get()
      .toObject(),
    { NL: 0 },
    'sum with empty result set',
  )

  deepEqual(
    await db.query('vote').sum('flap.hello').get().toObject(),
    { flap: { hello: 100 } },
    'nested object notation',
  )
})

await test('sum group by', async (t) => {
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
    await db.query('vote').sum('NL', 'AU').groupBy('country').get().toObject(),
    { bb: { NL: 10, AU: 0 }, aa: { NL: 20, AU: 15 } },
    'sum, top level, groupBy',
  )

  deepEqual(
    await db.query('vote').groupBy('country').get().toObject(),
    { bb: {}, aa: {} },
    'groupBy with no aggregation function',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'bb')
      .groupBy('country')
      .sum('NL', 'AU')
      .get()
      .toObject(),
    { bb: { NL: 10, AU: 0 } },
    'filter, groupBy on single distinct value',
  )
})

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
    [{ id: 1, votes: { NL: 30, AU: 15 } }],
    'brached include, sum, references',
  )

  // deepEqual(
  //   await db
  //     .query('sequence')
  //     .include((select) => {
  //       select('votes').groupBy('country').sum('NL', 'AU')
  //     })
  //     .get()
  //     .toObject(),
  //   [{ id: 1, votes: { aa: { AU: 15, NL: 20 }, bb: { AU: 0, NL: 10 } } }],
  //   'branched include, references, groupBy',
  // )

  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').filter('country', '=', 'aa').sum('NL', 'AU')
      })
      .get()
      .toObject(),
    [{ id: 1, votes: { NL: 20, AU: 15 } }],
    'branched include, references, filtered, groupBy',
  )
})

await test('sum performance', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    // maxModifySize: 1e6,
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
      },
    },
  })

  const countries = Object.keys(db.client.schema.types.vote.props).filter(
    (v) => v !== 'flap' && v !== 'country',
  )

  for (let i = 0; i < 1; i++) {
    const x: any = {
      country: allCountryCodes[~~(Math.random() * allCountryCodes.length)],
      flap: {
        hello: 1,
      },
    }
    for (const key of countries) {
      x[key] = ~~(Math.random() * 20)
    }
    delete x.sequence
    db.create('vote', x)
  }

  console.log(await db.drain())
})

// ***********************
// *      count
// ***********************

await test('count top level bignumber', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      sequence: {
        bla: 'uint32',
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('sequence', { bla: i })
  }

  await db.drain()

  const q = await db.query('sequence').count().get()
  equal(q.toObject().$count, 1e6)
})

await test('top level count', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

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
          country: { type: 'string' },
          AU: 'uint8',
          NL: 'uint8',
          IT: 'uint8',
        },
      },
    },
  })

  const nl1 = db.create('vote', {
    country: 'bb',
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

  // top level  ----------------------------------

  // ;(await db.query('vote').count().get()).debug()

  deepEqual(
    await db.query('vote').count().get().toObject(),
    { $count: 3 },
    'count, top level, prop',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'aa')
      .count()
      .get()
      .toObject(),
    { $count: 2 },
    'count with filter',
  )

  deepEqual(
    await db.query('vote').include('IT').count().get(),
    { $count: 3 },
    'count, top level, ignoring include',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'zz')
      .count()
      .get()
      .toObject(),
    { $count: 0 },
    'count, with no match filtering, string value',
  )

  deepEqual(
    await db.query('vote').filter('NL', '=', 20).count().get(),
    { $count: 1 },
    'count, with filtering an int value',
  )

  deepEqual(
    await db.query('vote').filter('NL', '>', 1e6).count().get(),
    { $count: 0 },
    'count, with no match filtering, int value',
  )
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
    [{ id: 1, votes: { $count: 3 } }],
    'brached include, count, references',
  )

  // deepEqual(
  //   await db
  //     .query('sequence')
  //     .include((select) => {
  //       select('votes').groupBy('country').sum('NL', 'AU')
  //     })
  //     .get()
  //     .toObject(),
  //   [{ id: 1, votes: { aa: { AU: 15, NL: 20 }, bb: { AU: 0, NL: 10 } } }],
  //   'branched include, references, groupBy',
  // )

  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').filter('country', '=', 'aa').count()
      })
      .get()
      .toObject(),
    [{ id: 1, votes: { $count: 2 } }],
    'count, branched include, references, filtered',
  )
})

await test('count group by', async (t) => {
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
    await db.query('vote').count().groupBy('country').get().toObject(),
    {
      bb: {
        $count: 1,
      },
      aa: {
        $count: 2,
      },
    },
    'count, top level, groupBy',
  )

  deepEqual(
    await db
      .query('vote')
      .filter('country', '=', 'bb')
      .groupBy('country')
      .count()
      .get()
      .toObject(),
    { bb: { $count: 1 } },
    'count, filter, groupBy on single distinct value',
  )
})

await test('variable key size', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      user: {
        props: {
          flap: { type: 'uint32' },
          country: { type: 'string' },
          name: { type: 'string' },
          articles: {
            items: {
              ref: 'article',
              prop: 'contributors',
            },
          },
        },
      },
      article: {
        props: {
          name: { type: 'string' },
          contributors: {
            items: {
              ref: 'user',
              prop: 'articles',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    country: 'NL',
    name: 'Mr snurp',
    flap: 10,
  })

  const flippie = db.create('user', {
    country: 'NL',
    name: 'Flippie',
    flap: 20,
  })

  const derpie = db.create('user', {
    country: 'BR',
    name: 'Derpie',
    flap: 30,
  })

  const dinkelDoink = db.create('user', {
    name: 'Dinkel Doink',
    flap: 40,
  })

  const cipolla = db.create('user', {
    country: 'IT',
    name: 'Carlo Cipolla',
    flap: 80,
  })

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp, flippie, derpie, dinkelDoink],
  })

  const stupidity = db.create('article', {
    name: 'Les lois fondamentales de la stupidité humaine',
    contributors: [cipolla],
  })

  deepEqual(
    await db
      .query('article')
      .include((q) => q('contributors').sum('flap'), 'name')
      .get()
      .toObject(),
    [
      { id: 1, name: 'The wonders of Strudel', contributors: { flap: 100 } },
      {
        id: 2,
        name: 'Les lois fondamentales de la stupidité humaine',
        contributors: { flap: 80 },
      },
    ],
    'sum, branched query, var len string',
  )

  deepEqual(
    await db.query('user').groupBy('name').sum('flap').get().toObject(),
    {
      Flippie: { flap: 20 },
      'Carlo Cipolla': { flap: 80 },
      'Mr snurp': { flap: 10 },
      'Dinkel Doink': { flap: 40 },
      Derpie: { flap: 30 },
    },
    'sum, groupBy, main',
  )

  deepEqual(
    await db.query('user').groupBy('country').sum('flap').get().toObject(),
    {
      $undefined: { flap: 40 },
      NL: { flap: 30 },
      BR: { flap: 30 },
      IT: { flap: 80 },
    },
    'sum, groupBy, main, $undefined',
  )

  // deepEqual(
  //   await db
  //     .query('article')
  //     .include((select) => {
  //       select('contributors').groupBy('name').sum('flap')
  //     })
  //     .get(),
  //   [
  //     {
  //       id: 1,
  //       contributors: {
  //         Flippie: { flap: 20 },
  //         'Mr snurp': { flap: 10 },
  //         Derpie: { flap: 30 },
  //         'Dinkel Doink': { flap: 40 },
  //       },
  //     },
  //     {
  //       id: 2,
  //       contributors: {
  //         'Carlo Cipolla': { flap: 80 },
  //       },
  //     },
  //   ],
  //   'sum, branched query, groupBy, references',
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

  // result.inspect(100)

  deepEqual(
    result.toObject(),
    [
      {
        id: 1,
        teamName: 'Grêmio',
        city: 'Porto Alegre',
        players: {
          Forward: { goalsScored: 22, gamesPlayed: 11 }, // Martin (10,5) + Pavon (12,6)
          Defender: { goalsScored: 1, gamesPlayed: 10 }, // Jemerson (1,10)
        },
      },
      {
        id: 2,
        teamName: 'Ajax',
        city: 'Amsterdam',
        players: {
          Forward: { goalsScored: 8, gamesPlayed: 7 }, // Wout (8,7)
          Defender: { goalsScored: 2, gamesPlayed: 9 }, // Jorrel (2,9)
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
          Forward: { goalsScored: 5, gamesPlayed: 5 }, // Lewandowski
        },
      },
    ],
    'Include parent props, with referenced items grouped by their own prop, and aggregations',
  )
})

await test('stddev', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

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
    country: 'bb',
    NL: 23,
  })
  const au1 = db.create('vote', {
    country: 'aa',
    NL: 15,
  })
  const au2 = db.create('vote', {
    country: 'aa',
    NL: 20,
  })
  const br1 = db.create('vote', {
    country: 'Brazil',
    NL: 50,
  })
  const s = db.create('sequence', { votes: [nl1, nl2, au1, au2, br1] })

  deepEqual(
    await db.query('vote').stddev('NL').groupBy('country').get().toObject(),
    {
      Brazil: {
        NL: 0,
      },
      bb: {
        NL: 6.5,
      },
      aa: {
        NL: 2.5,
      },
    },
    'stddev, top level, groupBy',
  )
  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').stddev('NL'))
      .get()
      .toObject(),
    [
      {
        id: 1,
        votes: {
          NL: 13.922643427165687,
        },
      },
    ],
    'stddev, branched References, no groupBy',
  )
  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').stddev('NL').groupBy('country'))
      .get()
      .toObject(),
    [
      {
        id: 1,
        votes: {
          Brazil: {
            NL: 0,
          },
          bb: {
            NL: 6.5,
          },
          aa: {
            NL: 2.5,
          },
        },
      },
    ],
    'stddev, branched References, groupBy',
  )

  // await db.query('vote').sum('NL').groupBy('country').get().inspect()
  // await db.query('vote').count().groupBy('country').get().inspect()
  // await db.query('vote').groupBy('country').get().inspect()
  // await db
  //   .query('sequence')
  //   .include((q) => q('votes').sum('NL'))
  //   .get()
  //   .inspect()
  // await db
  //   .query('sequence')
  //   .include((q) => q('votes').groupBy('country').sum('NL'))
  //   .get()
  //   .inspect()
  // await db
  // .query('sequence')
  // .include((q) => q('votes').groupBy('country').count())
  // .get()
  // .inspect()
  //   await db
  //     .query('sequence')
  //     .include((q) => q('votes').groupBy('country').stddev('NL'))
  //     .get()
  //     .inspect()
})

// test: when adding BR to props it messes up if country Brazil. Problably in .contains()
// test wildcards
// handle enum
// can use the index in selva if no filter
