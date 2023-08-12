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
      thing: {
        prefix: 'th',
        fields: {
          formFields: {
            type: 'array',
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

test('can use $delete inside array', async (t) => {
  const { client } = t.context
  const id = await client.set({
    $language: 'en',
    type: 'thing',
    formFields: [
      {
        title: 'foo',
      },
    ],
  })

  await client.set({
    // Using lang here would leave an empty title object.
    //$language: 'en',
    $id: id,
    formFields: {
      $assign: {
        $idx: 0,
        $value: {
          title: { $delete: true },
        },
      },
    },
  })

  const result = await client.get({
    $id: id,
    $all: true,
    createdAt: false,
    updatedAt: false,
  })
  t.deepEqual(result, {
    id: id,
    type: 'thing',
    formFields: [undefined],
  })
})
