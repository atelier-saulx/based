import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('rootProps', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

 await db.start({ clean: true })

  t.after(async () => {
    const d = performance.now()
    await db.destroy()
    console.log(performance.now() - d, 'ms')

  })

  db.putSchema({
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


  await db.update(rootData)

  let rootRes = (await db.query().get()).toObject()

  deepEqual(rootRes, { id: 1, ...rootData })

  const article = await db.create('article', {
    name: 'best article',
    body: 'success',
  })

  await db.update({
    bestArticles: [article],
  })

  rootRes = (await db.query().include('bestArticles').get()).toObject()

  deepEqual(rootRes, {
    id: 1,
    bestArticles: [{ id: 1, name: 'best article', body: 'success' }],
  })
})
