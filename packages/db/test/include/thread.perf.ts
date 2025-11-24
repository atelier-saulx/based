import { combineToNumber, readUint32, wait, writeUint32 } from '@based/utils'
import { registerQuery } from '../../src/client/query/registerQuery.js'
import { BasedDb } from '../../src/index.js'
import native from '../../src/native.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))
  // t.after(() => t.backup(db))

  // var d = Date.now()
  // var cnt = 0

  // const map2: any = new Map()

  // for (let i = 0; i < 1e6; i++) {
  //   const type = i % 20
  //   let t = map2.get(type)
  //   if (!t) {
  //     t = new Map()
  //     map2.set(type, new Map())
  //   }
  // }

  // d = Date.now()
  // for (let i = 0; i < 1e6; i++) {
  //   const type = i % 20
  //   const t = map2.get(type)
  //   t.set(i, (v: any) => {
  //     cnt++
  //   })
  // }
  // console.log('add buf ->', Date.now() - d, 'ms')

  // d = Date.now()
  // for (let i = 0; i < 1e6; i++) {
  //   const type = i % 20
  //   const t = map2.get(type)
  //   const x = t.get(i)
  //   if (x) {
  //     x(i)
  //   }
  // }
  // console.log('fire buf ->', Date.now() - d, 'ms')

  console.log('poop!')

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          nr: 'uint32',
          // flap: { type: 'string', compression: 'none' },
        },
      },
    },
  })

  // let x = []
  // for (let i = 0; i < 100; i++) {
  //   x.push('xxw qweudhweiofh')
  // }
  console.log('???')
  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      nr: 1,
      name: 'Mr poop',
    })
  }

  console.log('xxx')

  console.log('start query')

  await db.drain()
  // ;(await db.query('user').get()).debug()

  await perf(
    async () => {
      const q = []
      for (let i = 0; i < 1; i++) {
        q.push(
          db
            .query('user')
            .include('id')
            .range(10)
            // .range(0, 1_000_000 + i)
            .get(),
          // .inspect(),
        )
      }
      await Promise.all(q)
    },
    '1B nodes',
    { repeat: 1 },
  )

  console.log('done')

  // await wait(100)
})
