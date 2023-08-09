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

test.serial('collision', async (t) => {
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
