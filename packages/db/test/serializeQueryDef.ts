import { BasedDb, serialize } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('serialize', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          isNice: 'boolean',
        },
      },
    },
  })

  db.create('user', {})
  db.create('user', {
    isNice: true,
  })

  db.create('user', {
    isNice: false,
  })

  await db.drain()

  deepEqual((await db.query('user').get()).toObject(), [
    { id: 1, isNice: false },
    { id: 2, isNice: true },
    { id: 3, isNice: false },
  ])

  deepEqual(
    (await db.query('user').filter('isNice', '=', true).get()).toObject(),
    [{ id: 2, isNice: true }],
  )

  deepEqual((await db.query('user').filter('isNice').get()).toObject(), [
    { id: 2, isNice: true },
  ])

  deepEqual((await db.query('user').filter('isNice', false).get()).toObject(), [
    { id: 1, isNice: false },
    { id: 3, isNice: false },
  ])

  const def = db.query('user').filter('isNice', false).def

  const str = serialize(def)

  console.log(str)
  // // @ts-ignore
  // Map.prototype.toJSON = function () {
  //   return [...this]
  // }
  // // or, if you really want to use objects:
  // // @ts-ignore
  // Map.prototype.toJSON = function () {
  //   var obj = {}
  //   for (let [key, value] of this) obj[key] = value
  //   return obj
  // }
  // // and for Sets:
  // // @ts-ignore
  // Set.prototype.toJSON = function () {
  //   return [...this]
  // }

  // console.log(JSON.stringify(db.query('user').filter('isNice', false).def))
})
