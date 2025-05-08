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

  rootRes = await db.query().include('bestArticles').get()

  deepEqual(rootRes, {
    bestArticles: [{ id: 1, name: 'best article', body: 'success' }],
  })
})
