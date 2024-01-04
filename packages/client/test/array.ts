import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from './assertions'

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
      lekkerType: {
        prefix: 'vi',
        fields: {
          media: {
            type: 'array',
            values: {
              type: 'object',
              properties: {
                src: { type: 'string' },
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

test('should replace array', async (t) => {
  const { client } = t.context
  const originalMedia = [
    { src: 'http://wawa.com/111' },
    { src: 'http://wawa.com/222' },
    { src: 'http://wawa.com/333' },
  ]

  const lekker = await client.set({
    type: 'lekkerType',
    media: originalMedia,
  })
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $id: lekker,
      id: true,
      media: true,
    }),
    {
      id: lekker,
      media: originalMedia,
    }
  )

  await client.set({
    $id: lekker,
    media: [{ src: 'http://wawa.com/222' }, { src: 'http://wawa.com/333' }],
  })
  const r = await client.get({
    $language: 'en',
    $id: lekker,
    id: true,
    media: true,
  })
  t.log(r)
  deepEqualIgnoreOrder(t, r, {
    id: lekker,
    media: [{ src: 'http://wawa.com/222' }, { src: 'http://wawa.com/333' }],
  })

  await client.set({
    $id: lekker,
    media: [{ src: 'http://wawa.com/444' }],
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $id: lekker,
      id: true,
      media: true,
    }),
    {
      id: lekker,
      media: [{ src: 'http://wawa.com/444' }],
    }
  )

  await client.set({
    $id: lekker,
    media: [],
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $id: lekker,
      id: true,
      media: true,
    }),
    {
      id: lekker,
    }
  )
})

test('delete index', async (t) => {
  const { client } = t.context

  const lekker = await client.set({
    type: 'lekkerType',
    media: [{ src: 'http://wawa.com/111' }],
  })

  await client.set({
    $id: lekker,
    media: { $remove: { $idx: 0 } },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $id: lekker,
      id: true,
      media: true,
    }),
    {
      id: lekker,
    }
  )
})
