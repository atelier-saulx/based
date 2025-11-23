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

  console.log('poop')

  await wait(2000)
  const id = db.create('user', {
    nr: 1,
    // name: 'mr poop',
    // flap: x.join(' '),
  })

  // await wait(100)

  // // const q = db.query('user', 1)
  // // registerQuery(q)
  // // // maybe expose regisrer query on class

  // // const buf = q.buffer

  // // console.log('q', buf)

  // // await q.get().inspect()

  // var cnt = 0
  // let totalTime = 0

  // console.log('create?')
  for (let i = 0; i < 10000; i++) {
    db.create('user', {
      nr: i,
    })
  }
  // console.log('CREATE DONE?')

  // console.log('START QUERY')
  // await db.query('user').get()
  // console.log('QUERY DONE')

  // console.dir(db.server.blockMap.foreachBlock(console.log))

  // // await wait(1)
  // // native.getQueryBufThread(buf, db.server.dbCtxExternal)

  // await wait(1000)
  // console.log('FLAP')
  await db.query('user').get().inspect()

  console.log('this is sort!')
  await db.query('user').range(0, 5).sort('nr', 'desc').get().inspect()

  // await db.query('user').search('poop').get().inspect()

  // console.log(
  //   getAll(native.getQueryResults(db.server.dbCtxExternal)),
  //   'execed query items',
  // )

  // await db.query('user').get().inspect()

  // const amount = 1_000_000
  // const amount = 1_000_000

  // await wait(100)
  // var d = Date.now()

  // var d = Date.now()

  // for (let i = 0; i < amount; i++) {
  //   native.getQueryBufThread(buf, db.server.dbCtxExternal)
  // }

  // console.log('STAGING FOR EXEC TIME', Date.now() - d, 'ms')

  // const q2 = db.query('user').range(0, 1e6)
  // await q2.get().inspect()

  // const bufx = q2.buffer
  // console.log(bufx)

  // const qq: any = []

  // const z = []

  // for (let i = 1; i < 100 - 1; i++) {
  //   const x = bufx.slice()
  //   // writeUint32(x, i, 7)
  //   writeUint32(x, i, 0)

  //   z.push(x)

  //   // qq.push(db.server.getQueryBuf(x))
  // }

  // const d = Date.now()
  // for (const zz of z) {
  //   qq.push(db.server.getQueryBuf(zz))
  // }
  // await Promise.all(qq)
  // console.log(Date.now() - d, 'ms')

  // await db.query('user').range(0, 1e6).get().inspect()

  // db.server.addQueryListener(0, (v) => {
  //   console.log('yo', v)
  // })
  // // native.getQueryBufThread()

  // // save command
  // native.getQueryBufThread(
  //   new Uint8Array([0, 0, 0, 0, 67]),
  //   db.server.dbCtxExternal,
  // )

  // console.log('done')

  await wait(100)
})
