import anyTest, { TestInterface } from 'ava'
import getPort from 'get-port'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { BasedDbClient } from '../src'
import './assertions'
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
      aType: {
        prefix: 'at',
        fields: {
          field1: {
            type: 'number'
          },
          objectField: {
            type: 'object',
            properties: {
              field2: {
                type: 'object',
                properties: {
                  field3: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
  })

  t.context.client.unsubscribeSchema()
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('Mutate field number to string', async (t) => {
  const { client } = t.context

  const sets: Promise<string>[] = []
  for (let i = 0; i < 7000; i++) {
    sets.push(client.set({
      type: 'aType',
      field1: i,
      objectField: {
        field2: {
          field3: i
        }
      }
    }))
  }
  const ids = await Promise.all(sets)
  const id = ids[ids.length - 100]

  await client.set({
    $id: id,
    field1: 1234,
    objectField: {
      field2: {
        field3: 456
      }
    }
  })

  await t.notThrowsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            field1: { type: 'string' },
            objectField: {
              properties: {
                field2: {
                  properties: {
                    field3: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        }
      },
    }, {
      mode: SchemaUpdateMode.migration
    })
  )

  t.is(client.schema.types['aType'].fields['field1'].type, 'string')
  const { field1, objectField: { field2: { field3 } } } = await client.get({
    $id: ids[ids.length - 100],
    field1: true,
    objectField: true
  })
  t.is(typeof field1, 'string')
  t.is(field1, '1234')
  t.is(typeof field3, 'string')
  t.is(field3, '456')
})

