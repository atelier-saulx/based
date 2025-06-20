import { allCountryCodes, startAnalyticsDb } from '../src/index.js'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { receivePayload, trackEventDb } from '../src/trackEventsDb.js'
import { wait } from '@saulx/utils'
import { querySnapshots } from '../src/query.js'
import {
  createClientCtx,
  trackActive,
  trackEvent,
} from '../src/trackEventsClient.js'
import { unregisterClient } from '../src/startAnalyticsDb.js'
const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = './tmp'
const path = resolve(join(__dirname, relativePath))

const test = async () => {
  await rm(path, { recursive: true, force: true }).catch(() => {})

  const ctx = await startAnalyticsDb({
    path,
    config: {
      snapShotInterval: 100,
    },
  })

  // trackEventDb(ctx, 0, {
  //   event: 'view:homepage',
  //   count: 1,
  //   geo: 'NL',
  // })

  await wait(100)

  const clientCtx = createClientCtx(
    async (dbPayload) => {
      receivePayload(ctx, 1, dbPayload)
    },
    undefined,
    100,
  )

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
    for (let i = 0; i < 1e5; i++) {
      trackEvent(clientCtx, { event: 'derp', uniq: 'snurfelpants' + i })
    }

    console.log('db time', await ctx.db.drain())
    console.log('totalTime', performance.now() - jsTime, 'ms')
  }

  // await trackMany()

  await wait(100)

  // for (let i = 0; i < 1; i++) {
  //   await trackMany()
  //   await wait(100)
  // }

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'DE',
    active: 100,
  })

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'EN',
    active: 100,
  })

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'GG',
    active: 100,
  })

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'GG',
    active: 0,
  })

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'GG',
    active: 5,
  })

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'GG',
    active: 3,
  })

  await wait(100)

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'GG',
    active: 666,
  })

  await wait(100)

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'GG',
    active: 666,
  })

  await wait(100)

  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'GG',
    active: 0,
  })

  await wait(100)

  console.log('after setting to zero set to 0')

  await wait(100)

  console.log('after setting to zero set to 1')

  for (let i = 0; i < 1000; i++) {
    trackActive(clientCtx, {
      event: 'homepage',
      geo: allCountryCodes[~~(Math.random() * 5)],
      active: 1,
    })
  }
  trackActive(clientCtx, {
    event: 'homepage',
    geo: 'GG',
    active: 1,
  })

  await wait(100)

  for (let i = 0; i < 1000; i++) {
    trackActive(clientCtx, {
      event: 'homepage',
      geo: allCountryCodes[~~(Math.random() * 5)],
      active: 0,
    })
  }

  await wait(100)

  for (let i = 0; i < 1000; i++) {
    trackActive(clientCtx, {
      event: 'homepage',
      geo: allCountryCodes[~~(Math.random() * 5)],
      active: 0,
    })
    await wait(1)
  }

  // await wait(100)

  for (let i = 0; i < 1000; i++) {
    trackActive(clientCtx, {
      event: 'homepage',
      geo: allCountryCodes[~~(Math.random() * 5)],
      active: 2,
    })
  }

  await wait(100)

  console.dir(
    await querySnapshots(ctx, {
      events: ['derp', 'homepage'],
      current: true,
      // noGeo: true,
      range: { start: 0, end: 100 },
    }),
    { depth: null },
  )

  // c

  // const r = await querySnapshots(ctx, {
  //   events: ['view:homepage'],
  // })

  // console.dir(r['view:homepage'].reverse(), { depth: 10 })

  // await wait(100)

  // let r2 = await querySnapshots(ctx, {
  //   events: ['homepage'],
  // })

  // console.dir(r2['homepage'].reverse(), { depth: 10 })

  // await wait(100)
  // await wait(100)

  // trackActive(clientCtx, {
  //   event: 'homepage',
  //   geo: 'NL',
  //   active: 200,
  // })
  // await wait(100)

  // r2 = await querySnapshots(ctx, {
  //   events: ['homepage'],
  //   current: true,
  // })

  // console.dir(r2['homepage'].reverse(), { depth: 10 })

  // console.dir(
  //   await querySnapshots(ctx, {
  //     events: ['derp', 'homepage'],
  //     // current: true,
  //   }),
  //   { depth: null },
  // )

  clientCtx.close()
  unregisterClient(ctx, 1)

  await wait(100)

  // console.dir(
  //   await querySnapshots(ctx, {
  //     events: ['derp', 'homepage'],
  //     // current: true,
  //     range: { start: 0, end: 100 },
  //   }),
  //   { depth: null },
  // )

  await ctx.close()
}

await test()
