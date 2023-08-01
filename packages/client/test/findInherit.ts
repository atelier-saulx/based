import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (t) => {
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
      book: {
        prefix: 'bk',
        fields: {
          name: { type: 'string' },
        },
      },
      author: {
        prefix: 'au',
        fields: {
          fullname: { type: 'string' },
        },
      },
    },
  })

  // A small delay is needed after setting the schema
  await wait(100)

  await client.set({
    type: 'author',
    $id: 'au1',
    fullname: 'John Doe',
    children: [
      {
        type: 'book',
        $id: 'bk1',
        name: 'The Best Book',
      },
      {
        type: 'book',
        $id: 'bk2',
        name: 'The Worst Book',
      },
    ],
  })
  await client.set({
    type: 'author',
    $id: 'au2',
    fullname: 'Jane Doe',
    children: [
      {
        type: 'book',
        $id: 'bk3',
        name: 'Unfunny Book',
      },
    ],
  })

  // const filter = '"bk" e'
  // t.deepEqual(
  //   await client.redis.selva_hierarchy_find(
  //     '',
  //     '___selva_hierarchy',
  //     'descendants',
  //     'inherit_rpn',
  //     '{"name","^:fullname"}',
  //     'root',
  //     filter
  //   ),
  //   [
  //     ['bk1', ['name', 'The Best Book', 'fullname', ['au1', 'John Doe']]],
  //     ['bk2', ['name', 'The Worst Book', 'fullname', ['au1', 'John Doe']]],
  //     ['bk3', ['name', 'Unfunny Book', 'fullname', ['au2', 'Jane Doe']]],
  //   ]
  // )
  // t.deepEqual(
  //   await client.redis.selva_hierarchy_find(
  //     '',
  //     '___selva_hierarchy',
  //     'descendants',
  //     'order',
  //     'fullname',
  //     'asc',
  //     'inherit_rpn',
  //     '{"name","^:fullname"}',
  //     'root',
  //     filter
  //   ),
  //   [
  //     ['bk3', ['name', 'Unfunny Book', 'fullname', ['au2', 'Jane Doe']]],
  //     ['bk1', ['name', 'The Best Book', 'fullname', ['au1', 'John Doe']]],
  //     ['bk2', ['name', 'The Worst Book', 'fullname', ['au1', 'John Doe']]],
  //   ]
  // )
})

test.after(async (_t) => {
  await srv.destroy()
  client.destroy()
})

// TODO: Redis not exposed for low level test
test.serial.skip('find - inherit - low level', async (t) => {
  await client.updateSchema({
    languages: ['en'],
    types: {
      book: {
        prefix: 'bk',
        fields: {
          name: { type: 'string' },
        },
      },
      author: {
        prefix: 'au',
        fields: {
          fullname: { type: 'string' },
        },
      },
    },
  })

  // A small delay is needed after setting the schema
  await wait(100)

  await client.set({
    type: 'author',
    $id: 'au1',
    fullname: 'John Doe',
    children: [
      {
        type: 'book',
        $id: 'bk1',
        name: 'The Best Book',
      },
      {
        type: 'book',
        $id: 'bk2',
        name: 'The Worst Book',
      },
    ],
  })
  await client.set({
    type: 'author',
    $id: 'au2',
    fullname: 'Jane Doe',
    children: [
      {
        type: 'book',
        $id: 'bk3',
        name: 'Unfunny Book',
      },
    ],
  })

  // const filter = '"bk" e'
  // t.deepEqual(
  //   await client.redis.selva_hierarchy_find(
  //     '',
  //     '___selva_hierarchy',
  //     'descendants',
  //     'inherit_rpn',
  //     '{"name","^:fullname"}',
  //     'root',
  //     filter
  //   ),
  //   [
  //     ['bk1', ['name', 'The Best Book', 'fullname', ['au1', 'John Doe']]],
  //     ['bk2', ['name', 'The Worst Book', 'fullname', ['au1', 'John Doe']]],
  //     ['bk3', ['name', 'Unfunny Book', 'fullname', ['au2', 'Jane Doe']]],
  //   ]
  // )
  // t.deepEqual(
  //   await client.redis.selva_hierarchy_find(
  //     '',
  //     '___selva_hierarchy',
  //     'descendants',
  //     'order',
  //     'fullname',
  //     'asc',
  //     'inherit_rpn',
  //     '{"name","^:fullname"}',
  //     'root',
  //     filter
  //   ),
  //   [
  //     ['bk3', ['name', 'Unfunny Book', 'fullname', ['au2', 'Jane Doe']]],
  //     ['bk1', ['name', 'The Best Book', 'fullname', ['au1', 'John Doe']]],
  //     ['bk2', ['name', 'The Worst Book', 'fullname', ['au1', 'John Doe']]],
  //   ]
  // )
})

// TODO: waiting for creating node directly when setting children
test.serial.skip('find - inherit', async (t) => {
  await client.updateSchema({
    languages: ['en'],
    types: {
      book: {
        prefix: 'bk',
        fields: {
          name: { type: 'string' },
        },
      },
      author: {
        prefix: 'au',
        fields: {
          fullname: { type: 'string' },
        },
      },
    },
  })

  // A small delay is needed after setting the schema
  await wait(100)

  await client.set({
    type: 'author',
    $id: 'au1',
    fullname: 'John Doe',
    children: [
      {
        type: 'book',
        $id: 'bk1',
        name: 'The Best Book',
      },
      {
        type: 'book',
        $id: 'bk2',
        name: 'The Worst Book',
      },
    ],
  })
  await client.set({
    type: 'author',
    $id: 'au2',
    fullname: 'Jane Doe',
    children: [
      {
        type: 'book',
        $id: 'bk3',
        name: 'Unfunny Book',
      },
    ],
  })

  t.deepEqual(
    await client.get({
      books: {
        name: true,
        fullname: { $inherit: true },
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: {
              $field: 'type',
              $operator: '=',
              $value: 'book',
            },
          },
        },
      },
    }),
    {
      books: [
        {
          name: 'The Best Book',
          fullname: 'John Doe',
        },
        {
          name: 'The Worst Book',
          fullname: 'John Doe',
        },
        {
          name: 'Unfunny Book',
          fullname: 'Jane Doe',
        },
      ],
    }
  )
})

// TODO: waiting for creating node directly when setting children
test.serial.skip('find - inherit by type', async (t) => {
  await client.updateSchema({
    languages: ['en'],
    types: {
      book: {
        prefix: 'bk',
        fields: {
          name: { type: 'string' },
        },
      },
      author: {
        prefix: 'au',
        fields: {
          fullname: { type: 'string' },
        },
      },
      fakeAuthor: {
        prefix: 'fa',
        fields: {
          fullname: { type: 'string' },
        },
      },
    },
  })

  // A small delay is needed after setting the schema
  await wait(100)

  await client.set({
    type: 'author',
    $id: 'au1',
    fullname: 'John Doe',
    children: [
      {
        $id: 'fa1',
        fullname: 'Fake Author 1',
        children: [
          {
            type: 'book',
            $id: 'bk1',
            name: 'The Best Book',
          },
          {
            type: 'book',
            $id: 'bk2',
            name: 'The Worst Book',
          },
        ],
      },
    ],
  })
  await client.set({
    type: 'author',
    $id: 'au2',
    fullname: 'Jane Doe',
    children: [
      {
        $id: 'fa2',
        fullname: 'Fake Author 2',
        children: [
          {
            type: 'book',
            $id: 'bk3',
            name: 'Unfunny Book',
          },
        ],
      },
    ],
  })

  t.deepEqual(
    await client.get({
      books: {
        name: true,
        fullname: { $inherit: { $type: ['author', 'root'] } },
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: {
              $field: 'type',
              $operator: '=',
              $value: 'book',
            },
          },
        },
      },
    }),
    {
      books: [
        {
          name: 'The Best Book',
          fullname: 'John Doe',
        },
        {
          name: 'The Worst Book',
          fullname: 'John Doe',
        },
        {
          name: 'Unfunny Book',
          fullname: 'Jane Doe',
        },
      ],
    }
  )
})
