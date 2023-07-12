import test from 'ava'
import { BasedDbClient } from '../src'
import { ModifyOpSetType } from '../src/protocol/encode/modify/types'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'

test.serial('set string to num field, should fail', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  await client.updateSchema({
    languages: ['en', 'nl', 'de', 'fi'],
    $defs: {},
    prefixToTypeMapping: {
      po: 'post',
    },
    root: {
      prefix: 'ro',
      fields: {},
    },
    types: {
      post: {
        prefix: 'po',
        fields: {
          slug: { type: 'string' },
          num: { type: 'number' },
        },
      },
    },
  })

  await t.throwsAsync(
    client.set({
      $id: 'po1',
      slug: '/hello-world',
      num: 'flappie',
    })
  )

  const getResult = await client.command('object.get', ['', 'po1'])
  console.log('getResult', getResult)

  t.true(true)
})

test.serial.only('set primitive fields', async (t) => {
  const TIME = 2500

  const server = await startOrigin({
    port: 8081,
    name: 'default',
  })

  const client = new BasedDbClient()

  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  await client.updateSchema({
    languages: ['en', 'nl', 'de', 'fi'],
    $defs: {},
    prefixToTypeMapping: {
      po: 'post',
    },
    root: {
      prefix: 'ro',
      fields: {},
    },
    types: {
      post: {
        prefix: 'po',
        fields: {
          parents: { type: 'references' },
          slug: { type: 'string' },
          num: { type: 'number' },
          int: { type: 'integer' },
          bool: { type: 'boolean' },
          ts: { type: 'timestamp' },
          obj: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'string' },
            },
          },
        },
      },
    },
  })

  await client.set({
    $id: 'po1',
    slug: '/hello-world',
    num: 25.5,
    int: 112,
    ts: Date.now(),
    bool: true,
    obj: {
      a: 11,
      b: 'hello',
    },
  })

  await client.set({
    $id: 'po2',
    slug: '/second-post',
    parents: ['po1'],
  })

  const getResult = await client.command('object.get', ['', 'po1'])
  console.log('getResult', getResult)

  // TODO: remove
  // await client.command('save', ['test.sdb'])

  t.true(true)
})
