import test from '../shared/test.js'
import { throws, deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'

await test('sum top level', async (t) => {
  const db = await testDb(t, {
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

  db.create('sequence', { votes: [nl1, nl2, au1] })

  deepEqual(
    await db.query2('vote').sum('NL').get(),
    { NL: { sum: 30 } },
    'sum, top level, single prop',
  )

  deepEqual(
    await db.query2('vote').sum('NL', 'AU').get(),
    { NL: { sum: 30 }, AU: { sum: 15 } },
    'sum, top level, multiple props',
  )

  throws(async () => {
    // @ts-expect-error
    await db.query2('vote').sum().get()
  }, 'sum() returning nothing')

  deepEqual(
    await db.query2('vote').sum('flap.hello').get(),
    { flap: { hello: { sum: 100 } } },
    'nested object notation',
  )
})

await test('top level count', async (t) => {
  const db = await testDb(t, {
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
  db.drain()
  db.create('sequence', { votes: [nl1] })
  db.create('sequence', { votes: [nl2] })
  db.create('sequence', { votes: [au1] })

  //   // top level  ----------------------------------

  deepEqual(
    await db.query2('vote').count().get(),
    { count: 3 },
    'count, top level, prop',
  )

  // deepEqual(
  //   await db
  //     .query2('vote')
  //     .filter('country', '=', 'aa')  // string filter not implemented yet
  //     .count()
  //     .get()
  //     ,
  //   { count: 2 },
  //   'count, top level, with filter',
  // )

  deepEqual(
    await db.query2('vote').include('IT').count().get(),
    { count: 3 },
    'count, top level, ignoring include',
  )

  // deepEqual(
  //   await db
  //     .query2('vote')
  //     .filter('country', '=', 'zz') // string filter not implemented yet
  //     .count()
  //     .get()
  //     ,
  //   { count: 0 },
  //   'count, with no match filtering, string value',
  // )

  deepEqual(
    await db.query2('vote').filter('NL', '=', 20).count().get(),
    { count: 1 },
    'count, with filtering an int value',
  )

  deepEqual(
    await db.query2('vote').filter('NL', '>', 255).count().get(),
    { count: 0 },
    'count, with no match filtering, int value',
  )
})

await test('two phase accumulation', async (t) => {
  const db = await testDb(t, {
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
    await db.query2('vote').stddev('NL', { mode: 'sample' }).get(),
    {
      NL: { stddev: 15.56598856481656 },
    },
    'stddev, top level, NO groupBy, option = sample',
  )

  deepEqual(
    await db.query2('vote').stddev('NL', { mode: 'sample' }).get(),
    {
      NL: { stddev: 15.56598856481656 },
    },
    'stddev, top level, NO groupBy, no option (default = sample)',
  )

  deepEqual(
    await db.query2('vote').stddev('NL', { mode: 'population' }).get(),
    {
      NL: { stddev: 13.922643427165687 },
    },
    'stddev, top level, NO groupBy, option = population',
  )

  deepEqual(
    await db.query2('vote').sum('NL').get(),
    {
      NL: { sum: 118 },
    },
    'sum, top level, NO groupBy',
  )

  deepEqual(
    await db
      .query2('vote')
      .stddev('NL', { mode: 'population' })
      .groupBy('country')
      .get(),
    {
      Brazil: {
        NL: { stddev: 0 },
      },
      bb: {
        NL: { stddev: 6.5 },
      },
      aa: {
        NL: { stddev: 2.5 },
      },
    },
    'stddev, top level, groupBy',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').stddev('NL', { mode: 'population' }))
      .get(),
    [
      {
        id: 1,
        votes: {
          NL: { stddev: 13.922643427165687 },
        },
      },
    ],
    'stddev, branched References, no groupBy',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) =>
        q('votes').stddev('NL', { mode: 'population' }).groupBy('country'),
      )
      .get(),
    [
      {
        id: 1,
        votes: {
          Brazil: {
            NL: { stddev: 0 },
          },
          bb: {
            NL: { stddev: 6.5 },
          },
          aa: {
            NL: { stddev: 2.5 },
          },
        },
      },
    ],
    'stddev, branched References, groupBy',
  )
})
/*
await test('numeric types', async (t) => {
  const db = await testDb(t, {
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
    await db.query2('vote').groupBy('region').get(),
    {
      bb: {},
      aa: {},
      Great: {},
    },
    'empty aggregation function, group by',
  )

  deepEqual(
    await db.query2('vote').sum('NL', 'FI').groupBy('region').get(),
    {
      bb: {
        NL: { sum: 33 },
        FI: { sum: -1000000.3 },
      },
      aa: {
        NL: { sum: 93 },
        FI: { sum: 0 },
      },
      Great: {
        NL: { sum: 50 },
        FI: { sum: -50.999 },
      },
    },
    'sum, main, group by',
  )

  deepEqual(
    await db.query2('vote').count().groupBy('region').get(),
    {
      bb: {
        count: 2,
      },
      aa: {
        count: 2,
      },
      Great: {
        count: 1,
      },
    },
    'count, main, group by',
  )

  deepEqual(
    await db.query2('vote').avg('NL', 'PT', 'FI').groupBy('region').get(),
    {
      bb: {
        NL: { avg: 16.5 },
        PT: { avg: 21.5 },
        FI: { avg: -500000.15 },
      },
      aa: {
        NL: { avg: 46.5 },
        PT: { avg: 46.5 },
        FI: { avg: 0 },
      },
      Great: {
        NL: { avg: 50 },
        PT: { avg: 50 },
        FI: { avg: -50.999 },
      },
    },
    'avg, main, group by',
  )

  deepEqual(
    await db.query2('vote').hmean('NL', 'PT', 'FI').groupBy('region').get(),
    {
      bb: {
        NL: { hmean: 13.93939393939394 },
        PT: { hmean: 15.348837209302324 },
        FI: { hmean: 0 }, // harmonic mean when any of the values is 0 is 0 by definition
      },
      aa: {
        NL: { hmean: 46.236559139784944 },
        PT: { hmean: 46.236559139784944 },
        FI: { hmean: 0 }, // harmonic mean when any of the values is 0 is 0 by definition
      },
      Great: {
        NL: { hmean: 50 },
        PT: { hmean: 50 },
        FI: { hmean: -50.99900000000001 }, // harmonic mean is not designed for negative numbers but possible
      },
    },
    'hmean, main, group by',
  )

  deepEqual(
    await db
      .query2('vote')
      .stddev('NL', 'PL', { mode: 'population' })
      .groupBy('region')
      .get(),
    {
      bb: {
        NL: { stddev: 6.5 },
        PL: { stddev: 11.5 },
      },
      aa: {
        NL: { stddev: 3.5 },
        PL: { stddev: 11.5 },
      },
      Great: {
        NL: { stddev: 0 },
        PL: { stddev: 0 },
      },
    },
    'stddev, main, group by, pop',
  )

  deepEqual(
    await db.query2('vote').stddev('NL', 'PL').groupBy('region').get(),
    {
      bb: {
        NL: { stddev: 9.192388155425117 },
        PL: { stddev: 16.263455967290593 },
      },
      aa: {
        NL: { stddev: 4.949747468305833 },
        PL: { stddev: 16.263455967290593 },
      },
      Great: {
        NL: { stddev: 0 },
        PL: { stddev: 0 },
      },
    },
    'stddev, main, group by, default=sample',
  )

  deepEqual(
    await db
      .query2('vote')
      .var('NL', 'PL', { mode: 'population' })
      .groupBy('region')
      .get(),
    {
      bb: {
        NL: { variance: 42.25 },
        PL: { variance: 132.25 },
      },
      aa: {
        NL: { variance: 12.25 },
        PL: { variance: 132.25 },
      },
      Great: {
        NL: { variance: 0 },
        PL: { variance: 0 },
      },
    },
    'variance, main, group by, population',
  )
  deepEqual(
    await db
      .query2('vote')
      .var('NL', 'PL', { mode: 'sample' })
      .groupBy('region')
      .get(),
    {
      bb: { NL: { variance: 84.5 }, PL: { variance: 264.5 } },
      aa: { NL: { variance: 24.5 }, PL: { variance: 264.5 } },
      Great: { NL: { variance: 0 }, PL: { variance: 0 } },
    },
    'variance, main, group by, sample',
  )

  deepEqual(
    await db.query2('vote').var('NL', 'PL').groupBy('region').get(),
    {
      bb: { NL: { variance: 84.5 }, PL: { variance: 264.5 } },
      aa: { NL: { variance: 24.5 }, PL: { variance: 264.5 } },
      Great: { NL: { variance: 0 }, PL: { variance: 0 } },
    },
    'variance, main, group by, default (sample)',
  )

  deepEqual(
    await db.query2('vote').max('NL', 'NO', 'PT', 'FI').groupBy('region').get(),
    {
      bb: {
        NL: { max: 23 },
        NO: { max: -10 },
        PT: { max: 33 },
        FI: { max: 0 },
      },
      aa: {
        NL: { max: 50 },
        NO: { max: -43 },
        PT: { max: 50 },
        FI: { max: 0 },
      },
      Great: {
        NL: { max: 50 },
        NO: { max: -50 },
        PT: { max: 50 },
        FI: { max: -50.999 },
      },
    },
    'max, main, group by',
  )

  deepEqual(
    await db.query2('vote').min('NL', 'NO', 'PT', 'FI').groupBy('region').get(),
    {
      bb: {
        NL: { min: 10 },
        NO: { min: -23 },
        PT: { min: 10 },
        FI: { min: -1000000.3 },
      },
      aa: {
        NL: { min: 43 },
        NO: { min: -50 },
        PT: { min: 43 },
        FI: { min: 0 },
      },
      Great: {
        NL: { min: 50 },
        NO: { min: -50 },
        PT: { min: 50 },
        FI: { min: -50.999 },
      },
    },
    'min, main, group by',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').sum('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          NL: { sum: 176 },
        },
      },
    ],
    'references, not grouped',
  )
  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').avg('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          NL: { avg: 35.2 },
        },
      },
    ],
    'avg, references, not grouped',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').hmean('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          NL: { hmean: 24.18565978675536 },
        },
      },
    ],
    'hmean, references, not grouped',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').groupBy('region').sum('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            NL: { sum: 33 },
          },
          aa: {
            NL: { sum: 93 },
          },
          Great: {
            NL: { sum: 50 },
          },
        },
      },
    ],
    'sum, references, group by',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').groupBy('region').count())
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: { count: 2 },
          aa: { count: 2 },
          Great: { count: 1 },
        },
      },
    ],
    'count, references, group by',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) =>
        q('votes').groupBy('region').stddev('NL', { mode: 'population' }),
      )
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            NL: { stddev: 6.5 },
          },
          aa: {
            NL: { stddev: 3.5 },
          },
          Great: {
            NL: { stddev: 0 },
          },
        },
      },
    ],
    'stddev, references, group by',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').groupBy('region').stddev('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: { NL: { stddev: 9.192388155425117 } },
          aa: { NL: { stddev: 4.949747468305833 } },
          Great: { NL: { stddev: 0 } },
        },
      },
    ],
    'stddev, references, group by',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) =>
        q('votes').groupBy('region').var('NL', { mode: 'population' }),
      )
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            NL: { variance: 42.25 },
          },
          aa: {
            NL: { variance: 12.25 },
          },
          Great: {
            NL: { variance: 0 },
          },
        },
      },
    ],
    'variance, references, group by, pop',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) =>
        q('votes').groupBy('region').var('NL', { mode: 'sample' }),
      )
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: { NL: { variance: 84.5 } },
          aa: { NL: { variance: 24.5 } },
          Great: { NL: { variance: 0 } },
        },
      },
    ],
    'variance, references, group by, sample',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').groupBy('region').var('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: { NL: { variance: 84.5 } },
          aa: { NL: { variance: 24.5 } },
          Great: { NL: { variance: 0 } },
        },
      },
    ],
    'variance, references, group by, defaul (sample)',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').groupBy('region').avg('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            NL: { avg: 16.5 },
          },
          aa: {
            NL: { avg: 46.5 },
          },
          Great: {
            NL: { avg: 50 },
          },
        },
      },
    ],
    'avg, references, group by',
  )

  deepEqual(
    await db
      .query2('sequence')
      .include((q) => q('votes').groupBy('region').hmean('NL'))
      .get(),
    [
      {
        id: 1,
        votes: {
          bb: {
            NL: { hmean: 13.93939393939394 },
          },
          aa: {
            NL: { hmean: 46.236559139784944 },
          },
          Great: {
            NL: { hmean: 50 },
          },
        },
      },
    ],
    'hmean, references, group by',
  )
})

await test('fixed length strings', async (t) => {
  const db = await testDb(t, {
    types: {
      product: {
        name: { type: 'string', maxBytes: 10 },
        flap: 'number',
      },
      shelve: {
        code: { type: 'string', maxBytes: 4 },
        products: {
          items: {
            ref: 'product',
            prop: 'product',
          },
        },
      },
    },
  })

  const rnd = fastPrng()
  for (let i = 0; i < 100; i++) {
    let p = db.create('product', {
      name: `lala ${rnd(0, 10)}`,
      flap: Math.random() * 100,
    })
    db.drain()
    db.create('shelve', {
      code: `S${rnd(0, 10)}`,
      products: p,
    })
  }

  equal(
    Number(
      Object.keys(
        await db
          .query2('product')
          .include('*')
          .avg('flap')
          .groupBy('name')
          .get(),
      )[0].substring(4, 6),
    ) < 100,
    true,
    'fixed length strings on main',
  )

  equal(
    Number(
      Object.keys(
        await db
          .query2('shelve')
          .include((q) => q('products').avg('flap').groupBy('name'))
          .get(),
      )[0].substring(4, 6),
    ) < 100,
    true,
    'fixed length strings on references',
  )
})

await test('range', async (t) => {
  const db = await testDb(t, {
    types: {
      job: {
        day: 'timestamp',
        tip: 'number',
        employee: {
          ref: 'employee',
          prop: 'employee',
        },
      },
      employee: {
        name: 'string',
        area: {
          items: { ref: 'territory', prop: 'territory' },
        },
      },
      territory: {
        name: ter,
        flap: 'number',
        state: {
          ref: 'state',
          prop: 'state',
        },
      },
      state: {
        name: 'string',
      },
    },
  })

  const rnd = fastPrng(new Date().getTime())
  for (let i = 0; i < 10; i++) {
    const d = new Date('11/12/2024 00:00-3')
    db.create('job', {
      day: new Date(d.getTime() + 3600 * 1000 * rnd(2, 3)),
      tip: Math.random() * 20,
    })
    const s = db.create('state', {
      name: `statelala ${rnd(0, 2)}`,
    })
    const t = db.create('territory', {
      name: ter[rnd(0, ter.length - 1)],
      flap: Math.random() * 100,
      state: s,
    })
    db.create('employee', {
      name: `emplala ${rnd(0, 10)}`,
      area: t,
    })
  }

  deepEqual(
    Object.keys(
      await db
        .query2('job')
        .groupBy('day', { step: 'hour', timeZone: 'America/Sao_Paulo' })
        .avg('tip')
        // .range(0, 2)
        .get(),
    ).length,
    2,
    'range group by main',
  )

  deepEqual(
    Object.keys(
      await db
        .query2('employee')
        .include((q) => q('area').groupBy('name').sum('flap'), '*')
        .range(0, 2)
        .get(),
    ).length,
    2,
    'range group by references',
  )
})
*/
