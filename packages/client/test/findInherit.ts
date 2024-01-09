import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
import './assertions/index.js'
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
  await wait(200)

  await t.context.client.set({
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
  await t.context.client.set({
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
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('find - inherit', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
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
  await wait(200)

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

test('find - inherit by type', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
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
  await wait(200)

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
