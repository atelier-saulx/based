import anyTest, { TestInterface } from 'ava'
import getPort from 'get-port'
import { startOrigin, SelvaServer } from '@based/db-server'
import { BasedDbClient } from '../../src'
import '../assertions'

const test = anyTest as TestInterface<{
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
  t.context.client.subscribeSchema()

  console.log('updating schema')

  await t.context.client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      aType: {
        prefix: 'at',
        fields: {
          level1array: {
            type: 'array',
            values: { type: 'string' },
          },
        },
      },
    },
  })

  t.context.client.unsubscribeSchema()
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('Remove array field in strick mode should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            level1array: { $delete: true },
          },
        },
      },
    }),
    {
      message: /^Cannot remove "aType.level1array" in strict mode.$/,
    }
  )
})
test('Change array field in strick mode should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            level1array: { type: 'string' },
          },
        },
      },
    }),
    {
      message: /^Cannot change "aType.level1array" in strict mode.$/,
    }
  )

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            level1array: {
              values: { type: 'number' },
            },
          },
        },
      },
    }),
    {
      message: /^Cannot change "aType.level1array" in strict mode.$/,
    }
  )
})
