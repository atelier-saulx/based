import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
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
    root: {
      prefix: 'ro',
      fields: {},
    },
    types: {
      myclass: {
        prefix: 'cl',
        fields: {
          title: { type: 'text' },
          num: { type: 'number' },
          subclasses: { type: 'references' },
        },
      },
    },
  })

  const firstId = await t.context.client.set({
    type: 'myclass',
    title: { en: 'First class' },
  })

  const addSub = (n: number, i: number) =>
    i
      ? [
          {
            type: 'myclass',
            title: { en: `Subclass ${n}${i}` },
            num: n * i,
            parents: [],
            subclasses: addSub(n, i - 1),
          },
        ]
      : []
  for (let i = 0; i < 5; i++) {
    await t.context.client.set({
      $id: firstId,
      subclasses: {
        $add: {
          type: 'myclass',
          title: { en: `Subclass ${i}` },
          num: i,
          parents: [],
          subclasses: addSub(i, 100),
        },
      },
    })
  }
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('find', async (t) => {
  const { client } = t.context
  // simple nested - single query

  try {
    await wait(2e3)

    const firstId = (
      await client.get({
        $id: 'root',
        children: true,
      })
    ).children[0]
    t.assert(firstId)
    const res = await client.get({
      $id: firstId,
      items: {
        id: true,
        title: true,
        $list: {
          $find: {
            $traverse: 'subclasses',
            $recursive: true,
            $filter: {
              $field: 'num',
              $operator: '=',
              $value: 180,
            },
          },
        },
      },
    })
    t.deepEqual(res.items.length, 3)
  } catch (err) {
    console.error(err)
  }
})
