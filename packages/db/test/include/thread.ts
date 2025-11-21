import { readUint32, wait, writeUint32 } from '@based/utils'
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

  await db.setSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
          // flap: { type: 'string', compression: 'none' },
        },
      },
    },
  })

  let x = []
  for (let i = 0; i < 100; i++) {
    x.push('xxw qweudhweiofh')
  }

  // const id = await db.create('user', {
  //   nr: 1,
  //   // flap: x.join(' '),
  // })

  const q = db.query('user', 1)
  registerQuery(q)
  // maybe expose regisrer query on class

  const buf = q.buffer

  console.log('q', buf)

  // await q.get().inspect()

  var cnt = 0
  let totalTime = 0

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      nr: i,
    })
  }

  await db.query('user').get()

  console.log('BLOCMMAP!!!')
  console.dir(db.server.blockMap.foreachBlock(console.log))

  var modCnt = 1
  const callMod = () => {
    const makeThing = new Uint8Array([
      2, 2, 0, 9, 0, 0, 17, 3, 4, 0, 0, 0, 1, 0, 0, 0,
    ])
    modCnt++
    writeUint32(makeThing, modCnt, makeThing.byteLength - 4)
    native.modifyThread(makeThing, db.server.dbCtxExternal)
  }

  callMod()
  native.getQueryBufThread(buf, db.server.dbCtxExternal)

  callMod()

  await wait(1)
  native.getQueryBufThread(buf, db.server.dbCtxExternal)

  for (let i = 0; i < 5; i++) {
    if (i % 2) {
      await wait(0)
    }
    if (Math.random() < 0.5) {
      callMod()
      native.getQueryBufThread(buf, db.server.dbCtxExternal)
    } else {
      native.getQueryBufThread(buf, db.server.dbCtxExternal)
      callMod()
    }
  }

  callMod()

  await wait(1)
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

  const q2 = db.query('user').range(0, 1e6)
  await q2.get().inspect()

  const bufx = q2.buffer
  console.log(bufx)

  const qq: any = []

  const z = []

  for (let i = 1; i < 100 - 1; i++) {
    const x = bufx.slice()
    // writeUint32(x, i, 7)
    writeUint32(x, i, 0)

    z.push(x)

    // qq.push(db.server.getQueryBuf(x))
  }

  const d = Date.now()
  for (const zz of z) {
    qq.push(db.server.getQueryBuf(zz))
  }
  await Promise.all(qq)
  console.log(Date.now() - d, 'ms')

  await db.query('user').range(0, 1e6).get().inspect()

  // db.server.addQueryListener(9999, )
  // native.getQueryBufThread()

  // save command
  native.getQueryBufThread(
    new Uint8Array([6, 6, 6, 6, 67]),
    db.server.dbCtxExternal,
  )

  console.log('done')

  await wait(100)
})
