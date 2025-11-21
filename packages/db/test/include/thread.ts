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

  const getAll = (arr: ArrayBuffer[] | null) => {
    if (!arr) {
      // console.log('wairing?')
      return 0
    }
    let cnt = 0
    for (const buf of arr) {
      if (!buf) {
        console.log('thread has no response :(', cnt)
        continue
      } else {
        const v = new Uint8Array(buf)

        // console.log('heloo', v)
        for (let i = 0; i < v.byteLength; ) {
          const size = readUint32(v, i)
          cnt++

          // then we need the QueryId in the query itself (4 bytes for now)

          i += size
        }
      }
    }
    return cnt
  }

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

  let readyTime
  var isRdy = new Promise((resolve) => {
    readyTime = resolve
  })

  const amount = 1_000_000
  // const amount = 1_000_000

  await wait(100)
  var d = Date.now()

  const collector = () => {
    // console.log('check?', cnt)
    if (native.cnt == amount) {
      console.log('TOOK', Date.now() - d, '+/- 18ms')
      readyTime()
    } else {
      setTimeout(collector, 18)
    }
  }

  native.cnt = 0
  collector()

  // setTimeout(collector, 18)

  var d = Date.now()

  db.server.addQueryWorkerListener(new Uint8Array([6, 6, 6, 6, 67]), (x) => {
    console.log('derp', x)
  })

  // // // const x = []

  // // const bufSize = 1e6 * buf.byteLength
  // // const x = new Uint8Array(bufSize)
  for (let i = 0; i < amount; i++) {
    // x.set(buf, i * buf.byteLength)

    // x.push(buf)
    native.getQueryBufThread(buf, db.server.dbCtxExternal)
  }

  native.getQueryBufThread(
    new Uint8Array([6, 6, 6, 6, 67]),
    db.server.dbCtxExternal,
  )

  // // native.getQueryBufThreadBatch(x, db.server.dbCtxExternal)

  console.log('STAGING FOR EXEC TIME', Date.now() - d, 'ms')

  await isRdy

  console.log('done')
  // await wait(100)
})
