import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions/index.js'
import getPort from 'get-port'

const test = anyTest as TestFn<{
  srv: SelvaServer
  client: BasedDbClient
  port: number
}>

test.beforeEach(async (t) => {
  t.context.port = await getPort()
  console.log('origin')
  t.context.srv = await startOrigin({
    port: t.context.port,
    name: 'default',
  })

  console.log('connecting')
  t.context.client = new BasedDbClient()
  t.context.client.connect({
    port: t.context.port,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await t.context.client.updateSchema({
    language: 'en',
    translations: ['de'],
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

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test.skip('collision', async (t) => {
  const { client } = t.context
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
