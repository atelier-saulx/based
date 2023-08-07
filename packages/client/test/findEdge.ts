import test from 'ava'
import { BasedDbClient } from '../src'
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

  const firstId = await client.set({
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
    await client.set({
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

test.after(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

// TODO: $add not implemented
// message: 'value.$add.map is not a function'
test.serial.skip('find', async (t) => {
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
