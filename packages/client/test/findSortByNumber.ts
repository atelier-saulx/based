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

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en'],
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'string' },
          value: { type: 'number' },
        },
      },
    },
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

test.serial('sort by number with missing field values', async (t) => {
  await client.set({
    type: 'match',
    value: 1,
    title: 'value1',
  })
  await client.set({
    type: 'match',
    value: 2,
    title: 'value2',
  })
  await client.set({
    type: 'match',
    title: 'value none',
  })
  await client.set({
    type: 'match',
    value: 4,
    title: 'value4',
  })
  await client.set({
    type: 'match',
    title: 'value none',
  })

  t.deepEqual(
    await client.get({
      children: {
        value: true,
        $list: {
          $sort: {
            $field: 'value',
            $order: 'asc',
          },
        },
      },
    }),
    { children: [{ value: 1 }, { value: 2 }, { value: 4 }, {}, {}] }
  )
})
