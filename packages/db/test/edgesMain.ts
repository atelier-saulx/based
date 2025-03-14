import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('multiple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
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
          name: 'string',
          contributors: {
            type: 'references',
            items: {
              ref: 'user',
              prop: 'articles',
              $rating: 'uint32',
              $derp: 'string',
              $rdy: 'boolean',
            },
          },
        },
      },
    },
  })

  const mrDerp = await db.create('user', { name: 'mr Derp' })
  const mrFrap = await db.create('user', { name: 'mr Frap' })

  const fantasticalFriday = await db.create('article', {
    name: 'Fantastical Friday',
    contributors: [
      {
        id: mrDerp,
        $rdy: true,
        $rating: 66,
        $derp: 'a',
      },
      {
        id: mrFrap,
        $rdy: true,

        // $rating: 99,
        $derp: 'b',
      },
    ],
  })

  await db
    .query('article')
    .include('contributors.$rdy')
    .include('contributors.$rating')
    .include('contributors.$derp')
    .get()
    .inspect()
    .then((v) => v.debug())

  // await db.update('article', fantasticalFriday, {
  //   contributors: {
  //     set: [
  //       {
  //         id: mrDerp,
  //         $rating: 22,
  //         // $rdy: true,
  //       },
  //     ],
  //   },
  // })

  // await db
  //   .query('article')
  //   .include('contributors.$rdy')
  //   .include('contributors.$rating')
  //   .include('contributors.$derp')
  //   .get()
  //   .inspect()
  //   .then((v) => v.debug())

  // const typicalThursday = await db.create('article', {
  //   name: 'Typical Thursday',
  //   contributors: [
  //     {
  //       id: mrDerp,
  //       $rating: 1,
  //     },
  //   ],
  // })

  // await db.update('article', fantasticalFriday, {
  //   name: 'Fantastical Friday',
  //   contributors: [
  //     {
  //       id: mrDerp,
  //       $rating: 2,
  //     },
  //   ],
  // })
})
