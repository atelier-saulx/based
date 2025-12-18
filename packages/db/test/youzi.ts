import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal, throws, perf } from './shared/assert.js'
import { stat } from 'fs/promises'
import { join } from 'path'
import native from '../src/native.js'
import { statSync } from 'fs'

await test('youzi', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      article: {
        name: 'alias',
        body: 'string',
      },
    },
  })

  // let i = 10_000
  // while (i--) {
  //   db.create('article', {
  //     name: 'article. ' + i,
  //     // body: ''.padEnd(i, 'x'),
  //   })
  // }

  // await db.drain()

  db.server.on('error', console.error)

  let j = 1000
  const p: any[] = []
  const s: any[] = []
  const syncS: any[] = []
  let killed = false
  // native.saveCommon(join(t.tmp, 'common.sdb'), db.server.dbCtxExternal)
  while (j--) {
    if (killed) break
    native.saveCommon(join(t.tmp, 'common.sdb'), db.server.dbCtxExternal)
    // syncS.push(statSync(join(t.tmp, 'common.sdb')).size)
    s.push(
      stat(join(t.tmp, 'common.sdb')).then((stats) => {
        if (stats.size === 0) {
          killed = true
          // console.log('ZERO:', statSync(join(t.tmp, 'common.sdb')).size)
        }
        return stats
      }),
    )
    // syncS.push(statSync(join(t.tmp, 'common.sdb')).size)
    // syncS.push(statSync(join(t.tmp, 'common.sdb')).size)
  }

  // await db.drain()

  console.log('sizes', {
    syncSize: syncS,
    asyncSize: (await Promise.all(s)).map((stat) => stat.size),
  })
  // await Promise.all(p)
  console.log('yes2', (await stat(join(t.tmp, 'common.sdb'))).size)

  console.log(await db.query('article').get())
})
