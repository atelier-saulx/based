import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (_t) => {
  console.log('origin')
  srv = await startOrigin({
    port: 8081,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en'],
    types: {
      thing: {
        prefix: 'th',
        fields: {
          name: { type: 'string' },
        },
      },
      hello: {
        prefix: 'he',
        fields: {
          name: { type: 'string' },
          members: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                x: { type: 'string' },
                refs: { type: 'references' },
              },
            },
          },
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

// TODO: record wildcards
test.serial.skip('remove object from record', async (t) => {
  const thingId = await client.set({
    type: 'thing',
    name: 'blurp',
  })

  const id = await client.set({
    type: 'hello',
    name: 'derp',
    members: {
      0: {
        x: 'hallo',
        refs: [thingId],
      },
      1: {
        x: 'doei',
      },
    },
  })

  const res1 = await client.get({
    $id: id,
    name: true,
    members: {
      '*': {
        x: true,
        refs: true,
      },
    },
  })

  t.deepEqualIgnoreOrder(res1.members[0], { x: 'hallo', refs: [thingId] })
  t.deepEqualIgnoreOrder(res1.members[1], { x: 'doei' })

  await client.set({
    $id: id,
    members: {
      0: { $delete: true },
      1: { $delete: true },
    },
  })

  await wait(500)

  const res2 = await client.get({
    $id: id,
    name: true,
    members: {
      '*': {
        x: true,
        refs: true,
      },
    },
  })

  t.is(res2.members[1], undefined)
  t.is(res2.members[0], undefined)
})
