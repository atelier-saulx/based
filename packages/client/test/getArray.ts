import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port
test.beforeEach(async (t) => {
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
    languages: ['en', 'de', 'nl'],
    root: {
      fields: {
        value: { type: 'number' },
        nested: {
          type: 'object',
          properties: {
            fun: { type: 'string' },
          },
        },
      },
    },
    types: {
      lekkerType: {
        prefix: 'vi',
        fields: {
          strRec: {
            type: 'record',
            values: {
              type: 'string',
            },
          },
          textRec: {
            type: 'record',
            values: {
              type: 'text',
            },
          },
          objRec: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                floatArray: { type: 'array', values: { type: 'number' } },
                intArray: { type: 'array', values: { type: 'integer' } },
                objArray: {
                  type: 'array',
                  values: {
                    type: 'object',
                    properties: {
                      hello: { type: 'string' },
                      value: { type: 'integer' },
                      fvalue: { type: 'number' },
                    },
                  },
                },
                hello: {
                  type: 'string',
                },
                nestedRec: {
                  type: 'record',
                  values: {
                    type: 'object',
                    properties: {
                      value: {
                        type: 'number',
                      },
                      hello: {
                        type: 'string',
                      },
                    },
                  },
                },
                value: {
                  type: 'number',
                },
                stringValue: {
                  type: 'string',
                },
              },
            },
          },
          thing: { type: 'set', items: { type: 'string' } },
          ding: {
            type: 'object',
            properties: {
              dong: { type: 'set', items: { type: 'string' } },
              texty: { type: 'text' },
              dung: { type: 'number' },
              dang: {
                type: 'object',
                properties: {
                  dung: { type: 'number' },
                  dunk: { type: 'string' },
                },
              },
              dunk: {
                type: 'object',
                properties: {
                  ding: { type: 'number' },
                  dong: { type: 'number' },
                },
              },
            },
          },
          dong: { type: 'json' },
          dingdongs: { type: 'array', values: { type: 'string' } },
          floatArray: { type: 'array', values: { type: 'number' } },
          intArray: { type: 'array', values: { type: 'integer' } },
          tsArray: { type: 'array', values: { type: 'timestamp' } },
          refs: { type: 'references' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
      custom: {
        prefix: 'cu',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
      club: {
        prefix: 'cl',
        fields: {
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          value: { type: 'number' },
          description: { type: 'text' },
        },
      },
      yesno: {
        prefix: 'yn',
        fields: {
          bolYes: { type: 'boolean' },
          bolNo: { type: 'boolean' },
        },
      },
    },
  })
})

test.after(async (t) => {
  await srv.destroy()
  client.destroy()
})

// TODO: traversing object arrays
test.serial.skip('get - field with array', async (t) => {
  const id = await client.set({
    type: 'lekkerType',
    // thing: [],
    // dong: { dingdong: [] },
    // ding: { dong: [] },
    dingdongs: ['a', 'b', 'test'],
    intArray: [1, 2, 3, 4, 5],
    floatArray: [1.1, 2.2, 3.3, 4.4],
    tsArray: [1634032349768, 1634032355278],
    objRec: {
      abba: {
        intArray: [1, 2, 3, 4, 5],
        floatArray: [1.1, 2.2, 3.3, 4.4],
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
            fvalue: 1.5,
          },
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
        ],
      },
    },
  })

  // const x = await client.get({
  //   $id: id,
  //   objRec: {
  //     abba: {
  //       objArray: {
  //         $all: true,
  //         $list: {
  //           $sort: {
  //             $order: 'desc',
  //             $field: 'value',
  //           },
  //           $find: {
  //             $filter: [
  //               {
  //                 $field: 'value',
  //                 $operator: '>',
  //                 $value: 1,
  //               },
  //             ],
  //           },
  //         },
  //       },
  //     },
  //   },
  // })

  // console.log('OBJS', JSON.stringify(x, null, 2))
  // return

  const result = await client.get({
    $id: id,
    thing: true,
    dingdongs: true,
    children: true,
    descendants: true,
    refs: true,
    intArray: true,
    floatArray: true,
    objArray: true,
    tsArray: true,
    objRec: true,
  })

  t.deepEqual(result, {
    dingdongs: ['a', 'b', 'test'],
    intArray: [1, 2, 3, 4, 5],
    floatArray: [1.1, 2.2, 3.3, 4.4],
    tsArray: [1634032349768, 1634032355278],
    objRec: {
      abba: {
        intArray: [1, 2, 3, 4, 5],
        floatArray: [1.1, 2.2, 3.3, 4.4],
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
            fvalue: 1.5,
          },
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
        ],
      },
    },
  })

  const all = await client.get({
    $id: id,
    $all: true,
  })

  t.deepEqualIgnoreOrder(all, {
    id,
    // dong: { dingdong: [] },
    type: 'lekkerType',
    dingdongs: ['a', 'b', 'test'],
    intArray: [1, 2, 3, 4, 5],
    floatArray: [1.1, 2.2, 3.3, 4.4],
    tsArray: [1634032349768, 1634032355278],
    objRec: {
      abba: {
        intArray: [1, 2, 3, 4, 5],
        floatArray: [1.1, 2.2, 3.3, 4.4],
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
            fvalue: 1.5,
          },
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
        ],
      },
    },
  })

  let objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          hello: true,
          $list: true,
        },
      },
    },
  })

  t.deepEqualIgnoreOrder(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            hello: 'yes 1',
          },
          {
            hello: 'yes 2',
          },
          {
            hello: 'yes 3',
          },
        ],
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          value: true,
          $list: true,
        },
      },
    },
  })

  t.deepEqualIgnoreOrder(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            value: 1,
          },
          {
            value: 2,
          },
          {
            value: 3,
          },
        ],
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          fvalue: true,
          $list: true,
        },
      },
    },
  })

  t.deepEqualIgnoreOrder(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            fvalue: 1.5,
          },
          {
            fvalue: 1.6,
          },
          {
            fvalue: 1.7,
          },
        ],
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $all: true,
          $list: true,
        },
      },
    },
  })

  t.deepEqualIgnoreOrder(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
            fvalue: 1.5,
          },
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
        ],
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $all: true,
          $list: {
            $find: {
              $filter: [
                {
                  $field: 'value',
                  $operator: '>',
                  $value: 2,
                },
              ],
            },
          },
        },
      },
    },
  })

  t.deepEqualIgnoreOrder(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
        ],
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $all: true,
          $list: {
            $sort: {
              $order: 'desc',
              $field: 'value',
            },
            $find: {
              $filter: [
                {
                  $field: 'value',
                  $operator: '>',
                  $value: 1,
                },
              ],
            },
          },
        },
      },
    },
  })

  t.deepEqual(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
        ],
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $all: true,
          $list: {
            $sort: {
              $order: 'desc',
              $field: 'value',
            },
            $limit: 2,
            $offset: 0,
          },
        },
      },
    },
  })

  t.deepEqual(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
        ],
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $all: true,
          $list: {
            $sort: {
              $order: 'desc',
              $field: 'value',
            },
            $limit: 1,
            $offset: 1,
          },
        },
      },
    },
  })

  t.deepEqual(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
        ],
      },
    },
  })

  await client.set({
    $id: id,

    objRec: {
      abba: {
        objArray: {
          $push: {},
        },
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: true,
      },
    },
  })

  t.deepEqual(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
            fvalue: 1.5,
          },
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
          {},
        ],
      },
    },
  })

  await client.set({
    $id: id,

    objRec: {
      abba: {
        objArray: {
          $push: [
            {
              hello: 'yes 11',
              value: 11,
            },
            {
              hello: 'yes 12',
              value: 12,
            },
            {
              hello: 'yes 13',
              value: 13,
            },
          ],
        },
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: true,
      },
    },
  })

  t.deepEqual(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
            fvalue: 1.5,
          },
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
          {},
          {
            hello: 'yes 11',
            value: 11,
          },
          {
            hello: 'yes 12',
            value: 12,
          },

          {
            hello: 'yes 13',
            value: 13,
          },
        ],
      },
    },
  })

  await client.set({
    $id: id,

    objRec: {
      abba: {
        objArray: {
          $insert: {
            $value: [
              {
                hello: 'yes 11',
                value: 11,
              },
              {
                hello: 'yes 12',
                value: 12,
              },
              {
                hello: 'yes 13',
                value: 13,
              },
            ],
            $idx: 0,
          },
        },
      },
    },
  })

  objs = await client.get({
    $id: id,
    objRec: {
      abba: {
        objArray: true,
      },
    },
  })

  t.deepEqual(objs, {
    objRec: {
      abba: {
        objArray: [
          {
            hello: 'yes 11',
            value: 11,
          },
          {
            hello: 'yes 12',
            value: 12,
          },

          {
            hello: 'yes 13',
            value: 13,
          },
          {
            hello: 'yes 1',
            value: 1,
            fvalue: 1.5,
          },
          {
            hello: 'yes 2',
            value: 2,
            fvalue: 1.6,
          },
          {
            hello: 'yes 3',
            value: 3,
            fvalue: 1.7,
          },
          {},
          {
            hello: 'yes 11',
            value: 11,
          },
          {
            hello: 'yes 12',
            value: 12,
          },

          {
            hello: 'yes 13',
            value: 13,
          },
        ],
      },
    },
  })
})
