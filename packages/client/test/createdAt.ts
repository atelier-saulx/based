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
    translations: ['nl', 'de'],
    root: {
      fields: { value: { type: 'number' }, hello: { type: 'string' } },
    },
    types: {
      match: {
        prefix: 'ma',
        fields: {
          value: { type: 'number' },
          title: {
            type: 'text',
          },
          obj: {
            type: 'object',
            properties: {
              hello: { type: 'string' },
              hallo: { type: 'string' },
              num: { type: 'number' },
            },
          },
          nestedObj: {
            type: 'object',
            properties: {
              a: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                },
              },
              b: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                },
              },
            },
          },
          settySet: {
            type: 'set',
            items: {
              type: 'string',
            },
          },
          reffyRefs: {
            type: 'references',
          },
          reffyRef: {
            type: 'reference',
          },
        },
      },
      league: {
        prefix: 'cu',
        fields: {
          title: {
            type: 'text',
          },
        },
      },
      person: {
        prefix: 'pe',
        fields: {
          title: {
            type: 'text',
          },
        },
      },
      someTestThing: {
        prefix: 'vi',
        fields: {
          title: {
            type: 'text',
          },
          value: {
            type: 'number',
          },
        },
      },
      otherTestThing: {
        prefix: 'ar',
        fields: {
          title: {
            type: 'text',
          },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
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

test('createdAt is set', async (t) => {
  const { client } = t.context
  const before = Date.now()
  const match = await client.set({
    $language: 'en',
    type: 'match',
    title: 'yesh',
  })
  await wait(2)
  const after = Date.now()

  const result = await client.get({
    $language: 'en',
    $id: match,
    id: true,
    title: true,
    createdAt: true,
    updatedAt: true,
  })
  t.log({ result })

  const { createdAt, updatedAt } = result
  delete result.createdAt
  delete result.updatedAt

  t.deepEqual(result, {
    id: match,
    title: 'yesh',
  })

  t.true(
    typeof createdAt === 'number' && createdAt <= after && createdAt >= before
  )
  t.true(
    typeof updatedAt === 'number' && updatedAt <= after && updatedAt >= before
  )
})

test('createdAt+updatedAt are set', async (t) => {
  const { client } = t.context
  const before = Date.now()
  await wait(10)
  const person = await client.set({
    $language: 'en',
    type: 'person',
    title: 'yesh',
  })
  await wait(10)
  const after = Date.now()

  const result = await client.get({
    $language: 'en',
    $id: person,
    id: true,
    title: true,
    createdAt: true,
    updatedAt: true,
  })

  const createdAt = result.createdAt
  const updatedAt = result.updatedAt
  delete result.createdAt
  delete result.updatedAt

  t.deepEqual(result, {
    id: person,
    title: 'yesh',
  })

  t.true(
    typeof createdAt === 'number' && createdAt <= after && createdAt >= before
  )

  t.deepEqual(createdAt, updatedAt)
})

test('createdAt not set if provided in modify props', async (t) => {
  const { client } = t.context
  const match = await client.set({
    $language: 'en',
    type: 'match',
    title: 'yesh',
    createdAt: 12345,
  })

  const result = await client.get({
    $language: 'en',
    $id: match,
    id: true,
    title: true,
    createdAt: true,
  })

  t.deepEqual(result, {
    id: match,
    title: 'yesh',
    createdAt: 12345,
  })
})

test('createdAt not set if nothing changed', async (t) => {
  const { client } = t.context
  const before = Date.now()
  const person = await client.set({
    $language: 'en',
    type: 'person',
    title: 'yesh',
  })
  await wait(2)
  const after = Date.now()

  let result = await client.get({
    $language: 'en',
    $id: person,
    id: true,
    title: true,
    createdAt: true,
    updatedAt: true,
  })

  let createdAt = result.createdAt
  let updatedAt = result.updatedAt
  delete result.createdAt
  delete result.updatedAt

  t.deepEqual(result, {
    id: person,
    title: 'yesh',
  })

  t.true(
    typeof createdAt === 'number' && createdAt <= after && createdAt >= before
  )

  t.deepEqual(createdAt, updatedAt)

  await client.set({
    $language: 'en',
    type: 'person',
    title: 'yesh',
    children: [],
  })

  result = await client.get({
    $language: 'en',
    $id: person,
    id: true,
    title: true,
    createdAt: true,
    updatedAt: true,
  })

  createdAt = result.createdAt
  updatedAt = result.updatedAt
  delete result.createdAt
  delete result.updatedAt

  t.true(
    typeof createdAt === 'number' && createdAt <= after && createdAt >= before
  )

  t.deepEqual(createdAt, updatedAt)
})

test('automatic child creation and timestamps', async (t) => {
  const { client } = t.context
  const now = Date.now()
  await client.set({
    $id: 'viParent',
    title: {
      nl: 'nl',
    },
    children: [
      {
        type: 'match',
        title: {
          nl: 'child1',
        },
      },
      {
        type: 'match',
        title: {
          nl: 'child2',
        },
      },
      {
        type: 'match',
        title: {
          nl: 'child3',
        },
      },
    ],
  })

  const { children } = await client.get({
    $id: 'viParent',
    children: true,
  })

  for (const child of children) {
    const { createdAt, updatedAt } = await client.get({
      $id: child,
      createdAt: true,
      updatedAt: true,
    })

    t.true(createdAt >= now)
    t.true(updatedAt >= now)
  }
})

test('createdAt can be modified', async (t) => {
  const { client } = t.context
  const before = Date.now()
  const person = await client.set({
    $language: 'en',
    type: 'person',
    title: 'yesh',
  })
  await wait(2)
  const after = Date.now()

  let result = await client.get({
    $id: person,
    createdAt: true,
  })

  let createdAt = result.createdAt
  t.true(createdAt <= after && createdAt >= before)

  await client.set({
    $id: person,
    createdAt: 1000,
  })
  result = await client.get({
    $id: person,
    createdAt: true,
  })

  createdAt = result.createdAt
  t.deepEqual(createdAt, 1000)
})
