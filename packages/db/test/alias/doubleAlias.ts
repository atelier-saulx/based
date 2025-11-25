import { BasedDb } from '../../src/db.js'
import { deepEqual } from '../shared/assert.js'
import test from '../shared/test.js'

await test('aliasDouble', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      plot: {
        props: {
          uuid: 'alias',
          slug: 'alias',
          name: 'string',
        },
      },
    },
  })

  // : 'kavel-omval-naast-de-poort', slug: 'test-plot-2',
  const plot1 = db.create('plot', {
    slug: 'kavel-omval-naast-de-poort',
    name: 'test plot 1 (omval)',
    uuid: 'flap',
  })

  const plot2 = db.create('plot', {
    slug: 'test-plot-2',
    name: 'test plot 2',
    uuid: 'flap2',
  })

  deepEqual(
    await db
      .query('plot', {
        slug: 'test-plot-2',
      })
      .get(),
    { id: 2, uuid: 'flap2', slug: 'test-plot-2', name: 'test plot 2' },
  )

  deepEqual(
    await db
      .query('plot', {
        uuid: 'flap2',
      })
      .get(),
    { id: 2, uuid: 'flap2', slug: 'test-plot-2', name: 'test plot 2' },
  )
})
