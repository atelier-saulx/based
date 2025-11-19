import { wait } from '@based/utils'
import { registerQuery } from '../../src/client/query/registerQuery.js'
import { BasedDb } from '../../src/index.js'
import native from '../../src/native.js'
import test from '../shared/test.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
        },
      },
    },
  })

  const id = await db.create('user', {
    nr: 1,
  })

  const q = db.query('user', id)
  registerQuery(q)
  // maybe expose regisrer query on class

  const buf = q.buffer

  await q.get().inspect()

  console.log({ id, buf })

  var cnt = 0
  let totalTime = 0
  var d = Date.now()

  const collector = () => {
    if (native.cnt === 1e6) {
      console.log('TOOK', Date.now() - d, '+/- 100ms')
    } else {
      setTimeout(collector, 100)
    }
  }

  collector()

  var d = Date.now()
  for (let i = 0; i < 1e6; i++) {
    native.getQueryBufThread(buf, db.server.dbCtxExternal)
  }
  console.log('STAGING FOR EXEC TIME', Date.now() - d, 'ms')

  // await wait(100)
  // console.log(native.cnt)
  // await wait(100)
  // console.log(native.cnt)
  // await wait(100)
  // console.log(native.cnt)
  // await wait(100)
  // console.log(native.cnt)
  // const cnter = () => {
  //   cnt++
  // }
  // // var d = Date.now()
  // for (let i = 0; i < 1e6; i++) {
  //   db.server.getQueryBuf(buf).then(cnter)
  // }
  // console.log('STAGING FOR EXEC TIME', Date.now() - d, 'ms')

  await wait(10000)
})
