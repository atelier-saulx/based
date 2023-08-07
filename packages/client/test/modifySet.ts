import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

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
    languages: ['en'],
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

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

test.serial('float sets', async (t) => {
  const id1 = await client.set({
    type: 'thing',
    floats: [9001],
  })
  const { floats: floats1 } = await client.get({ $id: id1, floats: true })
  t.deepEqualIgnoreOrder(floats1, [9001])

  const id2 = await client.set({
    type: 'thing',
    floats: {
      $add: [1.5, 2, 3.5, 1.1],
    },
  })

  const { floats: floats2 } = await client.get({ $id: id2, floats: true })
  t.deepEqualIgnoreOrder(floats2, [1.5, 2, 3.5, 1.1])

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
  t.deepEqualIgnoreOrder(floats3, [1.5, 2, 3.5, 1.1, 7.7])
})

test.serial('integer sets', async (t) => {
  const id1 = await client.set({
    type: 'thing',
    integers: [1],
  })
  const { integers: integers1 } = await client.get({ $id: id1, integers: true })
  t.deepEqualIgnoreOrder(integers1, [1])

  const id2 = await client.set({
    type: 'thing',
    integers: {
      $add: [1, 2, 3],
    },
  })

  const { integers: integers2 } = await client.get({ $id: id2, integers: true })
  t.deepEqualIgnoreOrder(integers2, [1, 2, 3])

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
  t.deepEqualIgnoreOrder(integers3, [1, 2, 3, 4])
})

test.serial('string sets', async (t) => {
  const id1 = await client.set({
    type: 'thing',
    strings: ['abc'],
  })
  const { strings: strings1 } = await client.get({ $id: id1, strings: true })
  t.deepEqualIgnoreOrder(strings1, ['abc'])

  const id2 = await client.set({
    type: 'thing',
    strings: {
      $add: ['a', 'b', 'c'],
    },
  })

  const { strings: strings2 } = await client.get({ $id: id2, strings: true })
  t.deepEqualIgnoreOrder(strings2, ['a', 'b', 'c'])

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
  t.deepEqualIgnoreOrder(strings3, ['a', 'b', 'c', 'd'])
})
