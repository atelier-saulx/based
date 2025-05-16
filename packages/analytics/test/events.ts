import { startAnalyticsDb } from '../src/index.js'
// import {
//   convertToTimestamp,
//   DECODER,
//   equals,
//   readUint16,
//   readUint32,
//   setByPath,
//   wait,
//   writeUint32,
// } from '@saulx/utils'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { receivePayload, trackEventDb } from '../src/trackEventsDb.js'
import { wait } from '@saulx/utils'
import { querySnapshots } from '../src/query.js'
import { allCountryCodes } from '@based/db/test/shared/examples.js'
import { ENCODER, xxHash64 } from '@based/db'
import {
  createClientCtx,
  trackActive,
  trackEvent,
} from '../src/trackEventsClient.js'
const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = './tmp'
const path = resolve(join(__dirname, relativePath))

const test = async () => {
  await rm(path, { recursive: true, force: true }).catch(() => {})

  const ctx = await startAnalyticsDb({
    path,
    config: {
      snapShotInterval: 10,
    },
  })

  trackEventDb(ctx, 0, {
    event: 'view:homepage',
    count: 1,
    geo: 'NL',
  })

  await wait(100)

  const trackMany = async () => {
    const uniq: any = []
    // const randLen = 25 //~~(Math.random() * 1000)
    // for (let i = 0; i < randLen; i++) {
    //   const encoded = ENCODER.encode(
    //     (~~(Math.random() * 10000000)).toString(16),
    //   )
    //   uniq.push(xxHash64(encoded))
    // }
    // console.log({ uniq })
    const jsTime = performance.now()
    for (let i = 0; i < 1e6; i++) {
      trackEventDb(ctx, 0, {
        event: 'view:homepage' + (i % 100),
        // event: 'view:homepage' + (i % 20),
        count: 1,
        // uniq: Array.from({ length: i % 50 }).map(() =>
        //   xxHash64(ENCODER.encode((~~(Math.random() * 10000000)).toString(16))),
        // ),
        // uniq: uniq.slice(0, ~~(Math.random() * uniq.length)),
        geo: allCountryCodes[~~(Math.random() * allCountryCodes.length)],
      })
    }

    console.log('db time', await ctx.db.drain())
    console.log('totalTime', performance.now() - jsTime, 'ms')
  }

  await trackMany()

  await wait(100)

  for (let i = 0; i < 1; i++) {
    await trackMany()
    await wait(100)
  }

  const clientCtx = createClientCtx(async (dbPayload) => {
    receivePayload(ctx, 1, dbPayload)
  }, 10)

  // const clientCtx2 = createClientCtx(async (dbPayload) => {
  //   receivePayload(ctx, 2, dbPayload)
  // }, 10)

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'NL',
    active: 100,
  })

  await wait(100)

  const r = await querySnapshots(ctx, {
    events: ['view:homepage'],
  })

  console.dir(r['view:homepage'].reverse(), { depth: 10 })

  await wait(100)

  let r2 = await querySnapshots(ctx, {
    events: ['homepage'],
  })

  console.dir(r2['homepage'].reverse(), { depth: 10 })

  ctx.db.server.on('info', (info) => {
    console.log('x', info)
  })

  await wait(100)
  await wait(100)

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'NL',
    active: 200,
  })
  await wait(100)

  r2 = await querySnapshots(ctx, {
    events: ['homepage'],
    current: true,
  })

  console.dir(r2['homepage'].reverse(), { depth: 10 })

  ctx.db.server.on('info', (info) => {
    console.log('x', info)
  })

  clientCtx.close()
  await ctx.close()
}

await test()
