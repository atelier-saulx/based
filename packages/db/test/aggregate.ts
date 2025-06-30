import { equal } from 'node:assert'
import { BasedDb } from '../src/index.js'
import { allCountryCodes } from './shared/examples.js'
import test from './shared/test.js'
import { throws, deepEqual } from './shared/assert.js'
import { numberDisplays } from '@based/schema'

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

  const drainElapsedTime = await db.drain()
  equal(drainElapsedTime < 10, true, 'Acceptable modify performance')
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

  deepEqual(
    await db
      .query('sequence')
      .include((select) => {
        select('votes').groupBy('country').sum('NL', 'AU')
      })
      .get()
      .toObject(),
    [{ id: 1, votes: { aa: { AU: 15, NL: 20 }, bb: { AU: 0, NL: 10 } } }],
    'branched include, references, groupBy',
  )

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

await test('variable key sum', async (t) => {
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

  deepEqual(
    await db
      .query('article')
      .include((select) => {
        select('contributors').groupBy('name').sum('flap')
      })
      .get()
      .toObject(),
    [
      {
        id: 1,
        contributors: {
          Flippie: { flap: 20 },
          'Mr snurp': { flap: 10 },
          Derpie: { flap: 30 },
          'Dinkel Doink': { flap: 40 },
        },
      },
      {
        id: 2,
        contributors: {
          'Carlo Cipolla': { flap: 80 },
        },
      },
    ],
    'sum, branched query, groupBy, references',
  )
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

await test('two phase accumulation', async (t) => {
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
})

await test('numeric types', async (t) => {
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
          region: { type: 'string' },
          AU: 'uint8',
          AT: 'int8',
          NL: 'uint16',
          NO: 'int16',
          PT: 'uint32',
          PL: 'int32',
          FI: 'number',
        },
      },
    },
  })
  const nl1 = db.create('vote', {
    region: 'bb',
    NL: 10,
    NO: -10,
    PT: 10,
    PL: -10,
    FI: -1_000_000.3,
  })
  const nl2 = db.create('vote', {
    region: 'bb',
    NL: 23,
    NO: -23,
    PT: 33,
    PL: -33,
  })
  const au1 = db.create('vote', {
    region: 'aa',
    NL: 43,
    NO: -43,
    PT: 43,
    PL: -43,
  })
  const au2 = db.create('vote', {
    region: 'aa',
    NL: 50,
    NO: -50,
    PT: 50,
    PL: -20,
  })
  const br1 = db.create('vote', {
    region: 'Great',
    NL: 50,
    NO: -50,
    PT: 50,
    PL: -50,
    FI: -50.999,
  })
  const s = db.create('sequence', { votes: [nl1, nl2, au1, au2, br1] })

  deepEqual(
    await db.query('vote').groupBy('region').get(),
    {
      bb: {},
      aa: {},
      Great: {},
    },
    'empty aggregation function, group by',
  )
  deepEqual(
    await db.query('vote').sum('NL', 'FI').groupBy('region').get(),
    {
      bb: {
        NL: 33,
        FI: -1000000.3,
      },
      aa: {
        NL: 93,
        FI: 0,
      },
      Great: {
        NL: 50,
        FI: -50.999,
      },
    },
    'sum, main, group by',
  )
  deepEqual(
    await db.query('vote').count().groupBy('region').get(),
    {
      bb: {
        $count: 2,
      },
      aa: {
        $count: 2,
      },
      Great: {
        $count: 1,
      },
    },
    'count, main, group by',
  )
  deepEqual(
    await db.query('vote').avg('NL', 'PT', 'FI').groupBy('region').get(),
    {
      bb: {
        NL: 16.5,
        PT: 21.5,
        FI: -500000.15,
      },
      aa: {
        NL: 46.5,
        PT: 46.5,
        FI: 0,
      },
      Great: {
        NL: 50,
        PT: 50,
        FI: -50.999,
      },
    },
    'average, main, group by',
  )
  deepEqual(
    await db.query('vote').stddev('NL', 'PL').groupBy('region').get(),
    {
      bb: {
        NL: 6.5,
        PL: 11.5,
      },
      aa: {
        NL: 3.5,
        PL: 11.5,
      },
      Great: {
        NL: 0,
        PL: 0,
      },
    },
    'stddev, main, group by',
  )
  deepEqual(
    await db.query('vote').var('NL', 'PL').groupBy('region').get(),
    {
      bb: {
        NL: 42.25,
        PL: 132.25,
      },
      aa: {
        NL: 12.25,
        PL: 132.25,
      },
      Great: {
        NL: 0,
        PL: 0,
      },
    },
    'variance, main, group by',
  )
  deepEqual(
    await db.query('vote').max('NL', 'NO', 'PT', 'FI').groupBy('region').get(),
    {
      bb: {
        NL: 23,
        NO: -10,
        PT: 33,
        FI: 0,
      },
      aa: {
        NL: 50,
        NO: -43,
        PT: 50,
        FI: 0,
      },
      Great: {
        NL: 50,
        NO: -50,
        PT: 50,
        FI: -50.999,
      },
    },
    'max, main, group by',
  )
  deepEqual(
    await db.query('vote').min('NL', 'NO', 'PT', 'FI').groupBy('region').get(),
    {
      bb: {
        NL: 10,
        NO: -23,
        PT: 10,
        FI: -1000000.3,
      },
      aa: {
        NL: 43,
        NO: -50,
        PT: 43,
        FI: 0,
      },
      Great: {
        NL: 50,
        NO: -50,
        PT: 50,
        FI: -50.999,
      },
    },
    'min, main, group by',
  )
  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').sum('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          NL: 176,
        },
      },
    ],
    'references, not grouped',
  )
  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').avg('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          NL: 35.2,
        },
      },
    ],
    'avg, references, not grouped',
  )
  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').groupBy('region').sum('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            NL: 33,
          },
          aa: {
            NL: 93,
          },
          Great: {
            NL: 50,
          },
        },
      },
    ],
    'sum, references, group by',
  )
  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').groupBy('region').count())
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            $count: 2,
          },
          aa: {
            $count: 2,
          },
          Great: {
            $count: 1,
          },
        },
      },
    ],
    'count, references, group by',
  )
  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').groupBy('region').stddev('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            NL: 6.5,
          },
          aa: {
            NL: 3.5,
          },
          Great: {
            NL: 0,
          },
        },
      },
    ],
    'stddev, references, group by',
  )
  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').groupBy('region').var('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            NL: 42.25,
          },
          aa: {
            NL: 12.25,
          },
          Great: {
            NL: 0,
          },
        },
      },
    ],
    'variance, references, group by',
  )
  deepEqual(
    await db
      .query('sequence')
      .include((q) => q('votes').groupBy('region').avg('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            NL: 16.5,
          },
          aa: {
            NL: 46.5,
          },
          Great: {
            NL: 50,
          },
        },
      },
    ],
    'average, references, group by',
  )
})

await test('undefined numbers', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      vote: {
        props: {
          region: { type: 'string' },
          AU: 'uint8',
          FI: 'number',
        },
      },
    },
  })
  const eu1 = db.create('vote', {
    region: 'EU',
    AU: 10,
    FI: -1_000_000.3,
  })
  const eu2 = db.create('vote', {
    region: 'EU',
    AU: 23,
  })

  deepEqual(
    await db.query('vote').max('AU', 'FI').groupBy('region').get().toObject(),
    {
      EU: {
        AU: 23,
        FI: 0,
      },
    },
    'number is initialized with zero',
  )
  deepEqual(
    await db.query('vote').avg('AU', 'FI').groupBy('region').get().toObject(),
    {
      EU: {
        AU: 16.5,
        FI: -500_000.15,
      },
    },
    'avg affected by count because number is initialized with zero',
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
    await db.query('beer').avg('price').groupBy('type').get(),
    {
      Tripel: {
        price: 11.85,
      },
      Wit: {
        price: 7.2,
      },
    },
    'group by enum in main',
  )

  const beers = 1e5
  const years = [1940, 1990, 2013, 2006]
  for (let i = 0; i < beers; i++) {
    const beer = await db.create('beer', {
      name: 'Beer' + i,
      type: types[(types.length * Math.random()) | 0],
      price: Math.random() * 100,
      year: years[(years.length * Math.random()) | 0],
    })
  }

  const startTime1 = performance.now()
  await db.query('beer').avg('price').get()
  const elapsedTime1 = performance.now() - startTime1
  equal(elapsedTime1 < 10, true, 'Acceptable main agg performance')

  const startTime2 = performance.now()
  await db.query('beer').groupBy('year').get()
  const elapsedTime2 = performance.now() - startTime2
  equal(elapsedTime2 < 20, true, 'Acceptable group by main prop performance')

  const startTime3 = performance.now()
  await db.query('beer').groupBy('type').get()
  const elapsedTime3 = performance.now() - startTime3
  equal(elapsedTime3 < 20, true, 'Acceptable group by enum main performance')

  const startTime4 = performance.now()
  await db.query('beer').max('price').groupBy('type').get()
  const elapsedTime4 = performance.now() - startTime4
  equal(
    elapsedTime4 < 30,
    true,
    'Acceptable agg + enum main group by performance',
  )
})

await test('refs with enums ', async (t) => {
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
      .get(),
    [
      {
        id: 1,
        movies: {
          Crime: {
            $count: 2,
          },
        },
      },
      {
        id: 2,
        movies: {
          Crime: {
            $count: 1,
          },
        },
      },
    ],
    'count group by enum in refs',
  )
})

await test.skip('edges agregation', async (t) => {
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
            prop: 'actors',
            $rating: 'uint16',
          },
        },
      },
      actor: {
        name: 'string',
        movies: {
          items: {
            ref: 'movie',
            prop: 'movies',
          },
        },
      },
    },
  })

  const a1 = db.create('actor', {
    name: 'Uma Thurman',
  })
  const a2 = db.create('actor', {
    name: 'Jonh Travolta',
  })

  const m1 = await db.create('movie', {
    name: 'Kill Bill',
    actors: [
      {
        id: a1,
        $rating: 55,
      },
    ],
  })
  const m2 = await db.create('movie', {
    name: 'Pulp Fiction',
    actors: [
      {
        id: a1,
        $rating: 63,
      },
      {
        id: a2,
        $rating: 77,
      },
    ],
  })

  // await db
  //   .query('movie')
  //   .include('name')
  //   .include('actors.$rating')
  //   .include('actors.name')
  //   .get()
  //   .inspect(10)

  // edges unreacheable
  db.query('movie').max('actors.$rating').get().inspect(10)
})
