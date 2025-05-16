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
import { trackEvent } from '../src/trackEventsDb.js'
import { wait } from '@saulx/utils'
import { querySnapshots } from '../src/query.js'
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

  trackEvent(ctx, 0, {
    event: 'view:homepage',
    count: 1,
    geo: 'NL',
  })

  await wait(100)

  trackEvent(ctx, 0, {
    event: 'view:homepage',
    count: 10,
    geo: 'NL',
  })

  await wait(100)

  const r = await querySnapshots(ctx, {
    events: ['view:homepage'],
  })

  console.dir(r, { depth: 10 })

  await wait(100)

  await ctx.close()
}

await test()
