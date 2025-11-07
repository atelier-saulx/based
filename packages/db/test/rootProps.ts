import { BLOCK_CAPACITY_MAX } from '@based/schema/def'
import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('rootProps', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(async () => t.backup(db))

  await db.setSchema({
    props: {
      myString: 'string',
      myBoolean: 'boolean',
      bestArticles: {
        items: {
          ref: 'article',
        },
      },
    },
    types: {
      article: {
        props: {
          name: 'string',
          body: 'string',
        },
      },
    },
  })

  deepEqual(
    db.server.schemaTypesParsed['_root'].blockCapacity,
    BLOCK_CAPACITY_MAX,
  )

  const rootData = {
    myString: 'im the root',
    myBoolean: true,
  }

  const article = db.create('article', {
    name: 'best article',
    body: 'success',
  })

  await db.update(rootData)

  let rootRes = await db.query().get().toObject()

  deepEqual(rootRes, rootData)

  await db.update({
    bestArticles: [article],
  })

  rootRes = await db.query().include('bestArticles').get().toObject()

  deepEqual(rootRes, {
    bestArticles: [{ id: 1, name: 'best article', body: 'success' }],
  })

  const rootRes2 = await db
    .query('_root', 1)
    .include('bestArticles')
    .get()
    .toObject()

  deepEqual(rootRes, rootRes2)

  await db.update('_root', 1, { myBoolean: false })
  deepEqual(await db.query('_root', 1).include('myBoolean').get().toObject(), { myBoolean: false })
})
