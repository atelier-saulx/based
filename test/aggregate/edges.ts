import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'

await test('edges aggregation', async (t) => {
  const db = await testDb(t, {
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
            $role: 'string',
            $roleType: ['Lead', 'Supporting', 'Cameo', 'Extra', 'Voiceover'],
            $salary: 'uint16',
            $hired: 'timestamp',
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
        $role: 'Supporting',
        $roleType: 'Lead',
        $salary: 12000,
        $hired: new Date('2025-01-01'),
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
        $role: 'Mia Wallace',
        $roleType: 'Lead',
        $salary: 300,
        $hired: new Date('1994-12-11'),
      },
      {
        id: a2,
        $rating: 77,
        $hating: 3,
        $role: 'Vincent Vega',
        $roleType: 'Lead',
        $salary: 300,
        $hired: new Date('1994-12-11'),
      },
    ],
  })

  /*---------------------------*/
  /*       NESTED SINTAX       */
  /*---------------------------*/

  deepEqual(
    await db.query('movie').sum('actors.strong').get(),
    //@ts-ignore
    [
      { id: 1, actors: { strong: { sum: 10 } } },
      { id: 2, actors: { strong: { sum: 15 } } },
    ],
    'nested sintax with references',
  )

  deepEqual(
    await db.query('movie').max('actors.$rating').sum('actors.$hating').get(),
    //@ts-ignore
    [
      { id: 1, actors: { $rating: { max: 55 }, $hating: { sum: 5 } } },
      { id: 2, actors: { $rating: { max: 77 }, $hating: { sum: 10 } } },
    ],
    'nested sintax with edges',
  )

  /*----------------------------*/
  /*       BRANCHED QUERY       */
  /*----------------------------*/

  deepEqual(
    await db
      .query('movie')
      // @ts-ignore
      .include((q) => q('actors').max('$rating'))
      .get(),
    [
      {
        id: 1,
        actors: {
          $rating: {
            max: 55,
          },
        },
      },
      {
        id: 2,
        actors: {
          $rating: {
            max: 77,
          },
        },
      },
    ],
    'single edge aggregation, branched query',
  )

  deepEqual(
    await db
      .query('movie')
      //@ts-ignore
      .include((q) => q('actors').max('$rating').sum('$hating'))
      .get(),
    [
      {
        id: 1,
        actors: {
          $rating: {
            max: 55,
          },
          $hating: {
            sum: 5,
          },
        },
      },
      {
        id: 2,
        actors: {
          $rating: {
            max: 77,
          },
          $hating: {
            sum: 10,
          },
        },
      },
    ],
    'multiple edges with multiple agg functions, branched query',
  )

  deepEqual(
    await db
      .query('movie')
      //@ts-ignore
      .include((q) => q('actors').max('$rating', '$hating'))
      .get(),
    [
      {
        id: 1,
        actors: {
          //@ts-ignore
          $rating: {
            max: 55,
          },
          $hating: {
            max: 5,
          },
        },
      },
      {
        id: 2,
        actors: {
          //@ts-ignore
          $rating: {
            max: 77,
          },
          $hating: {
            max: 7,
          },
        },
      },
    ],
    'multiple edges on same agg function, branched query',
  )

  /*-----------------------------------*/
  /*          GROUP BY EDGE.           */
  /*-----------------------------------*/

  // string edge
  const strEdg = await db
    .query('movie')
    .sum('actors.strong')
    .groupBy('actors.$role')
    .get()

  deepEqual(
    strEdg,
    [
      //@ts-ignore
      { id: 1, actors: { Supporting: { strong: { sum: 10 } } } },
      //@ts-ignore
      {
        id: 2,
        actors: {
          //@ts-ignore
          'Mia Wallace': { strong: { sum: 10 } },
          'Vincent Vega': { strong: { sum: 5 } },
        },
      },
    ],
    'string edge',
  )

  // enum edge
  const enumEdg = await db
    .query('movie')
    .sum('actors.$rating')
    .groupBy('actors.$roleType')
    .get()

  deepEqual(
    enumEdg,
    [
      {
        id: 1,
        actors: {
          //@ts-ignore
          Lead: { $rating: { sum: 55 } },
        },
      },
      {
        id: 2,
        actors: {
          //@ts-ignore
          Lead: { $rating: { sum: 140 } },
        },
      },
    ],
    'enum edge',
  )

  // numeric edge
  const numEdg = await db
    .query('movie')
    .sum('actors.strong')
    .groupBy('actors.$salary')
    .get()

  deepEqual(
    numEdg,
    [
      //@ts-ignore
      { id: 1, actors: { 12000: { strong: { sum: 10 } } } },
      //@ts-ignore
      { id: 2, actors: { 300: { strong: { sum: 15 } } } },
    ],
    'numeric edge',
  )

  // temporal interval edge
  const tempIntEdg = await db
    .query('movie')
    .sum('actors.strong')
    .groupBy('actors.$hired', { step: 'year' })
    .get()

  deepEqual(
    tempIntEdg,
    [
      //@ts-ignore
      { id: 1, actors: { 2025: { strong: { sum: 10 } } } },
      //@ts-ignore
      { id: 2, actors: { 1994: { strong: { sum: 15 } } } },
    ],
    'temporal interval edge',
  )

  const numIntEdg = await db
    .query('movie')
    .sum('actors.strong')
    .groupBy('actors.$hating', { step: 2 })
    .get()

  deepEqual(
    numIntEdg,
    [
      //@ts-ignore
      { id: 1, actors: { 5: { strong: { sum: 10 } } } },
      {
        id: 2,
        //@ts-ignore
        actors: { 3: { strong: { sum: 5 } }, 7: { strong: { sum: 10 } } },
      },
    ],
    'numeric interval edge',
  )
})
