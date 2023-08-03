import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
const port = 8081
test.beforeEach(async (t) => {
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
      blurf: {
        prefix: 'bl',
        fields: {
          title: { type: 'text' },
          randoObject: {
            type: 'object',
            properties: {
              title: { type: 'text' },
            },
          },
          randoArray: {
            type: 'array',
            values: {
              type: 'object',
              properties: {
                title: { type: 'text' },
              },
            },
          },
          randoRecord: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                title: { type: 'text' },
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

test.serial('language in all types of objects', async (t) => {
  await client.updateSchema({
    languages: ['en'],
    types: {
      blurf: {
        prefix: 'bl',
        fields: {
          title: { type: 'text' },
          randoObject: {
            type: 'object',
            properties: {
              title: { type: 'text' },
            },
          },
          randoArray: {
            type: 'array',
            values: {
              type: 'object',
              properties: {
                title: { type: 'text' },
              },
            },
          },
          randoRecord: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                title: { type: 'text' },
              },
            },
          },
        },
      },
    },
  })

  await client.set({
    $id: 'bl1',
    $language: 'en',
    title: 'engTitle',
    randoObject: { title: 'randoObject.engTitle' },
    randoArray: [{ title: 'randoArray.engTitle' }],
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'bl1',
      $language: 'en',
      title: true,
      randoObject: true,
    }),
    {
      title: 'engTitle',
      randoObject: {
        title: 'randoObject.engTitle',
      },
    }
  )

  await t.throwsAsync(() =>
    client.set({
      $type: 'blurf',
      title: 'someTitle',
    })
  )
  await t.throwsAsync(() =>
    client.set({
      $type: 'blurf',
      randoObject: { title: 'someTitle' },
    })
  )
  await t.throwsAsync(() =>
    client.set({
      $type: 'blurf',
      randoArray: [{ title: 'someTitle' }],
    })
  )
  await t.throwsAsync(() =>
    client.set({
      $type: 'blurf',
      randoRecord: {
        thing: { title: 'someTitle' },
      },
    })
  )
})
