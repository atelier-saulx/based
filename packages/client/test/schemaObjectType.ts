import anyTest, { TestInterface } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { SchemaUpdateMode } from '../src/types'

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
    languages: ['en', 'de', 'nl'],
    types: {
      lekkerType: {
        prefix: 'vi',
        fields: {
          value: { type: 'number' },
          ding: {
            type: 'object',
            properties: {
              texty: { type: 'text' },
              dung: { type: 'number' },
            },
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

test('Remove property on object field in strict mode', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        lekkerType: {
          fields: {
            ding: {
              properties: {
                dung: {
                  $delete: true
                }
              }
            }
          },
        },
      },
    }), {
    message: /^Cannot remove field '.*' in flexible mode with exsiting nodes.$/
  }
  )
})

test('Remove property on object field in flexible mode with exsiting nodes', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'lekkerType',
    ding: {
      dung: 123
    }
  })


  await t.throwsAsync(
    client.updateSchema({
      types: {
        lekkerType: {
          fields: {
            ding: {
              properties: {
                dung: {
                  $delete: true
                }
              }
            }
          },
        },
      },
    }, {
      mode: SchemaUpdateMode.flexible
    }), {
    message: /^Cannot remove field '.*' type in strict mode$/
  }
  )
})

test.only('Remove property on object field in flexible mode without exsiting nodes', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema({
      types: {
        lekkerType: {
          fields: {
            ding: {
              properties: {
                dung: {
                  $delete: true
                }
              }
            }
          },
        },
      },
    }, {
      mode: SchemaUpdateMode.flexible
    })
  )
  const newSchema = client.schema
  t.log(JSON.stringify(newSchema, null, 2))
  // @ts-ignore
  t.false(newSchema.types['lekkerType'].fields.ding?.properties.hasOwnProperty('title'))
})
