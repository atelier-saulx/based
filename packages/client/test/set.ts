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
          slug: { type: 'string' },
          num: { type: 'number' },
        },
      },
    },
  })

  await client.set({
    $id: 'po1',
    slug: '/hello-world',
    num: 25,
  })

  const getResult = await client.command('object.get', ['', 'po1'])
  console.log('getResult', getResult)

  t.true(true)
})
