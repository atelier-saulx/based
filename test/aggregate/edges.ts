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

  /*---------------------------*/
  /*       NESTED SINTAX       */
  /*---------------------------*/

  deepEqual(
    await db.query2('movie').sum('actors.strong').get(),
    //@ts-ignore
    [
      { id: 1, actors: { strong: { sum: 10 } } },
      { id: 2, actors: { strong: { sum: 15 } } },
    ],
    'nested sintax with references',
  )

  deepEqual(
    await db.query2('movie').max('actors.$rating').sum('actors.$hating').get(),
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
      .query2('movie')
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
      .query2('movie')
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
      .query2('movie')
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
})

/*-----------------------------------*/
/*          GROUP BY EDGE TEST       */
/*-----------------------------------*/
