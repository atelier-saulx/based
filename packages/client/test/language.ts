import anyTest, { TestInterface } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

const test = anyTest as TestInterface<{
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

test.afterEach(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('language in all types of objects', async (t) => {
  const { client } = t.context
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
