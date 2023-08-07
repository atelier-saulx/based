import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port
test.beforeEach(async (_t) => {
  port = await getPort()
  console.log('origin')
  srv = await startOrigin({
    port,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en', 'de'],
    types: {
      thing: {
        prefix: 'th',
        fields: {
          name: { type: 'string' },
        },
      },
    },
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
})

// TODO: Setting too much nodes at the same time?
// Error finding frame RangeError [ERR_OUT_OF_RANGE]: The value of "offset" is out of range. It must be >= 0 and <= 0. Received 1
//     at new NodeError (node:internal/errors:399:5)
//     at boundsError (node:internal/buffer:88:9)
//     at Buffer.readUInt8 (node:internal/buffer:254:5)
//     at h (/Users/nfrade/work/saulx/based-db/node_modules/data-record/src/accessors.ts:204:38)
//     at deserialize (/Users/nfrade/work/saulx/based-db/node_modules/data-record/src/serializer.ts:141:17)
//     at findFrame (/Users/nfrade/work/saulx/based-db/packages/client/src/protocol/decode/index.ts:20:50)
//     at incoming (/Users/nfrade/work/saulx/based-db/packages/client/src/incoming.ts:28:22)
//     at BasedDbClient.onData (/Users/nfrade/work/saulx/based-db/packages/client/src/index.ts:278:13)
//     at Socket.<anonymous> (/Users/nfrade/work/saulx/based-db/packages/client/src/socket/index.ts:42:14)
//     at Socket.emit (node:events:513:28) {
//   code: 'ERR_OUT_OF_RANGE'
// }
test.serial.skip('collision', async (t) => {
  let n = 100
  const allIds: any = []
  while (n--) {
    const ids = await Promise.all(
      Array.from(Array(5000)).map(() => {
        return client.set({
          type: 'thing',
          name: 'name',
        })
      })
    )

    allIds.push(...ids)
    const expectedUniqueIds = allIds.length
    const actualUniqueIds = new Set(allIds).size
    if (expectedUniqueIds !== actualUniqueIds) {
      console.log({ expectedUniqueIds, actualUniqueIds })
      t.fail()
      break
    }
  }

  t.pass()
})
