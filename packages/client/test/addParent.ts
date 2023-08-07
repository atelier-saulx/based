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
test.beforeEach(async (t) => {
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
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

test.serial(
  'when using parents.$add empty, root should still be added in ancestors (low prio)',
  async (t) => {
    await client.updateSchema({
      types: {
        sport: {
          prefix: 'sp',
          fields: {
            num: { type: 'number' },
          },
        },
      },
    })

    await client.set({
      type: 'sport',
      $id: 'sp11',
      num: 1,
      parents: {
        $add: [],
      },
    })

    t.deepEqualIgnoreOrder(await client.get({ $id: 'sp11', ancestors: true }), {
      ancestors: ['root'],
    })
  }
)
