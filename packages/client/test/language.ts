import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions/index.js'
import getPort from 'get-port'
import { SchemaUpdateMode } from '../src/types.js'
import { deepEqualIgnoreOrder } from './assertions/index.js'

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

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('language in all types of objects', async (t) => {
  const { client } = t.context
  await client.updateSchema(
    {
      language: 'en',
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
    },
    {
      mode: SchemaUpdateMode.flexible,
    }
  )

  await client.set({
    $id: 'bl1',
    $language: 'en',
    title: 'engTitle',
    randoObject: { title: 'randoObject.engTitle' },
    randoArray: [{ title: 'randoArray.engTitle' }],
  })

  deepEqualIgnoreOrder(
    t,
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
