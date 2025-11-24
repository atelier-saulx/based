import { combineToNumber, readUint32, wait, writeUint32 } from '@based/utils'
import { registerQuery } from '../../src/client/query/registerQuery.js'
import { BasedDb } from '../../src/index.js'
import native from '../../src/native.js'
import test from '../shared/test.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())
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
  const id = await db.create('user', {
    nr: 1,
    name: 'Mr poop',
  })
  console.log('xxx')

  console.log('start query')
  ;(await db.query('user').get()).debug()
  console.log('done query')

  // console.log('done')

  await wait(100)
})
