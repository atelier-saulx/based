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
    root: {
      fields: { value: { type: 'number' } },
    },
    types: {
      thing: {
        prefix: 'th',
        fields: {
          floats: {
            type: 'set',
            items: {
              type: 'number',
            },
          },
          integers: {
            type: 'set',
            items: {
              type: 'integer',
            },
          },
          strings: {
            type: 'set',
            items: {
              type: 'string',
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

test('float sets', async (t) => {
  const { client } = t.context
  const id1 = await client.set({
    type: 'thing',
    floats: [9001],
  })
  const { floats: floats1 } = await client.get({ $id: id1, floats: true })
  deepEqualIgnoreOrder(t, floats1, [9001])

  const id2 = await client.set({
    type: 'thing',
    floats: {
      $add: [1.5, 2, 3.5, 1.1],
    },
  })

  const { floats: floats2 } = await client.get({ $id: id2, floats: true })
  deepEqualIgnoreOrder(t, floats2, [1.5, 2, 3.5, 1.1])

  await client.set({
    $id: id2,
    floats: { $add: 7.7 },
  })
  t.throwsAsync(
    client.set({
      $id: id2,
      floats: { $add: [NaN] },
    })
  )
  t.throwsAsync(
    client.set({
      $id: id2,
      floats: { $add: ['abc'] },
    })
  )

  const { floats: floats3 } = await client.get({ $id: id2, floats: true })
  deepEqualIgnoreOrder(t, floats3, [1.5, 2, 3.5, 1.1, 7.7])
})

test('integer sets', async (t) => {
  const { client } = t.context
  const id1 = await client.set({
    type: 'thing',
    integers: [1],
  })
  const { integers: integers1 } = await client.get({ $id: id1, integers: true })
  deepEqualIgnoreOrder(t, integers1, [1])

  const id2 = await client.set({
    type: 'thing',
    integers: {
      $add: [1, 2, 3],
    },
  })

  const { integers: integers2 } = await client.get({ $id: id2, integers: true })
  deepEqualIgnoreOrder(t, integers2, [1, 2, 3])

  await client.set({
    $id: id2,
    integers: { $add: [4] },
  })
  t.throwsAsync(
    client.set({
      $id: id2,
      integers: { $add: ['abc'] },
    })
  )

  const { integers: integers3 } = await client.get({ $id: id2, integers: true })
  deepEqualIgnoreOrder(t, integers3, [1, 2, 3, 4])
})

test('string sets', async (t) => {
  const { client } = t.context
  const id1 = await client.set({
    type: 'thing',
    strings: ['abc'],
  })
  const { strings: strings1 } = await client.get({ $id: id1, strings: true })
  deepEqualIgnoreOrder(t, strings1, ['abc'])

  const id2 = await client.set({
    type: 'thing',
    strings: {
      $add: ['a', 'b', 'c'],
    },
  })

  const { strings: strings2 } = await client.get({ $id: id2, strings: true })
  deepEqualIgnoreOrder(t, strings2, ['a', 'b', 'c'])

  await client.set({
    $id: id2,
    strings: { $add: ['d'] },
  })
  t.throwsAsync(
    client.set({
      $id: id2,
      strings: { $add: [1234] },
    })
  )

  const { strings: strings3 } = await client.get({ $id: id2, strings: true })
  deepEqualIgnoreOrder(t, strings3, ['a', 'b', 'c', 'd'])
})
