import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('aliasFilter', async (t) => {
  const db = await testDb(t, {
    types: {
      plot: {
        props: {
          uuid: 'alias',
          slug: 'alias',
          name: 'string',
          age: 'uint8',
        },
      },
    },
  })

  // : 'kavel-omval-naast-de-poort', slug: 'test-plot-2',
  const plot1 = await db.create('plot', {
    slug: 'a',
    name: 'test plot 1 (omval)',
    uuid: 'flap',
    age: 20,
  })

  const a = await db.query('plot', { slug: 'kavel-omval-naast-de-poort' }).get()

  const b = await db
    .query('plot', { slug: 'kavel-omval-naast-de-poort' })
    .filter('age', '>', 10)
    .get()

  deepEqual(a, b)
})
