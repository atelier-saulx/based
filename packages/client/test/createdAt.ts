import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'
import getPort from 'get-port'

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
    languages: ['en', 'nl', 'de'],
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

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

test.serial('createdAt is set', async (t) => {
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

test.serial('createdAt+updatedAt are set', async (t) => {
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

test.serial('createdAt not set if provided in modify props', async (t) => {
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

test.serial('createdAt not set if nothing changed', async (t) => {
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

test.serial('automatic child creation and timestamps', async (t) => {
  const now = Date.now()
  const parent = await client.set({
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

test.serial('createdAt can be modified', async (t) => {
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
