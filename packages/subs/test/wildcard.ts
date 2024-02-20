import { basicTest, deepEqualIgnoreOrder } from './assertions/index.js'
import { destroySubscriber, subscribe } from '../src/index.js'
import { wait } from '@saulx/utils'

const test = basicTest({
  language: 'en',
  types: {
    league: {
      prefix: 'le',
      fields: {
        name: { type: 'string' },
        thing: { type: 'string' },
      },
    },
    match: {
      prefix: 'ma',
      fields: {
        name: { type: 'string' },
        description: { type: 'text' },
        value: {
          type: 'number',
        },
        record: {
          type: 'record',
          values: {
            type: 'object',
            properties: {
              a: {
                type: 'string',
              },
              b: {
                type: 'string',
              },
              nestedRecord: {
                type: 'record',
                values: {
                  type: 'object',
                  properties: {
                    a: {
                      type: 'string',
                    },
                    b: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
        },
        status: { type: 'number' },
      },
    },
  },
})

test('sub find - list with wildcard', async (t) => {
  // simple nested - single query
  const client = t.context.client
  await client.set({
    $id: 'ma1',
    type: 'match',
    name: 'match 1',
    value: 1,
    record: {
      obj: {
        a: 'abba',
        b: 'babba',
        nestedRecord: {
          hello: {
            a: 'abba',
            b: 'babba',
          },
          yellow: {
            a: 'abba2',
            b: 'babba2',
          },
        },
      },
    },
  })

  await client.set({
    $id: 'ma2',
    type: 'match',
    name: 'match 2',
    value: 2,
    record: {
      obj: {
        a: '2_abba',
        b: '2_babba',
        nestedRecord: {
          hello: {
            a: '2_abba',
            b: '2_babba',
          },
          yellow: {
            a: '2_abba2',
            b: '2_babba2',
          },
        },
      },
    },
  })

  let cnt = 0
  subscribe(
    client,
    {
      $id: 'root',
      id: true,
      items: {
        name: true,
        record: {
          '*': {
            a: true,
            b: true,
          },
        },
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
            ],
          },
        },
      },
    },
    (v: any) => {
      if (cnt === 0) {
        // console.dir({ v }, { depth: 6 })
        t.deepEqual(v, {
          id: 'root',
          items: [
            {
              name: 'match 1',
              record: {
                obj: { a: 'abba', b: 'babba' },
              },
            },
            {
              name: 'match 2',
              record: {
                obj: { a: '2_abba', b: '2_babba' },
              },
            },
          ],
        })
      } else if (cnt === 1) {
        t.deepEqual(v, {
          id: 'root',
          items: [
            {
              name: 'match 1',
              record: {
                obj: { a: 'abba', b: 'babba' },
                newObj: { a: 'new yes' },
              },
            },
            {
              name: 'match 2',
              record: {
                obj: { a: '2_abba', b: '2_babba' },
              },
            },
          ],
        })
      } else {
        t.fail()
      }

      cnt++
    }
  )

  await wait(1e3)

  t.deepEqual(cnt, 1)

  await client.set({
    $id: 'ma1',
    record: {
      newObj: {
        a: 'new yes',
      },
    },
  })

  await wait(1e3)

  t.deepEqual(cnt, 2)
  destroySubscriber(client)
})

test('sub find - single with wildcard', async (t) => {
  // simple nested - single query
  const client = t.context.client
  await client.set({
    $id: 'ma1',
    type: 'match',
    name: 'match 1',
    value: 1,
    record: {
      obj: {
        a: 'abba',
        b: 'babba',
        nestedRecord: {
          hello: {
            a: 'abba',
            b: 'babba',
          },
          yellow: {
            a: 'abba2',
            b: 'babba2',
          },
        },
      },
    },
  })

  let cnt = 0
  subscribe(
    client,
    {
      $id: 'ma1',
      id: true,
      name: true,
      record: {
        '*': {
          a: true,
          b: true,
        },
      },
    },
    (v: any) => {
      if (cnt === 0) {
        deepEqualIgnoreOrder(t, v, {
          id: 'ma1',
          name: 'match 1',
          record: {
            obj: { a: 'abba', b: 'babba' },
          },
        })
      } else if (cnt === 1) {
        deepEqualIgnoreOrder(t, v, {
          id: 'ma1',
          name: 'match 1',
          record: {
            obj: { a: 'abba', b: 'babba' },
            newObj: { a: 'new yes' },
          },
        })
      } else {
        t.fail()
      }

      cnt++
    }
  )

  await wait(1e3)

  t.deepEqual(cnt, 1)

  await client.set({
    $id: 'ma1',
    record: {
      newObj: {
        a: 'new yes',
      },
    },
  })

  await wait(1e3)

  t.deepEqual(cnt, 2)
  destroySubscriber(client)
})
