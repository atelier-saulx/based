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
          level1number: {
            type: 'number',
          },
          level1string: {
            type: 'string',
          },
          level1object: {
            type: 'object',
            properties: {
              level2object: {
                type: 'object',
                properties: {
                  level3number: { type: 'number' },
                  level3string: { type: 'string' },
                },
              },
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

test('Mutate field number to string', async (t) => {
  const { client } = t.context

  const sets: Promise<string>[] = []
  for (let i = 0; i < 7000; i++) {
    sets.push(
      client.set({
        type: 'aType',
        level1number: i,
        level1object: {
          level2object: {
            level3number: i,
          },
        },
      })
    )
  }
  const ids = await Promise.all(sets)
  const id = ids[ids.length - 100]

  await client.set({
    $id: id,
    level1number: 1234,
    level1object: {
      level2object: {
        level3number: 456,
      },
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1number: { type: 'string' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3number: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        mode: SchemaUpdateMode.migration,
      }
    )
  )

  t.is(client.schema.types['aType'].fields['level1number'].type, 'string')
  const {
    level1number,
    level1object: {
      level2object: { level3number },
    },
  } = await client.get({
    $id: ids[ids.length - 100],
    level1number: true,
    level1object: true,
  })
  t.is(typeof level1number, 'string')
  t.is(level1number, '1234')
  t.is(typeof level3number, 'string')
  t.is(level3number, '456')
})

test('Mutate field string to number', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'aType',
    level1string: '1234.56',
    level1object: {
      level2object: {
        level3string: '456',
      },
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1string: { type: 'number' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3string: {
                        type: 'number',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        mode: SchemaUpdateMode.migration,
      }
    )
  )

  t.is(client.schema.types['aType'].fields['level1string'].type, 'number')
  const {
    level1string,
    level1object: {
      level2object: { level3string },
    },
  } = await client.get({
    $id: id,
    level1string: true,
    level1object: true,
  })
  t.is(typeof level1string, 'number')
  t.is(level1string, 1234.56)
  t.is(typeof level3string, 'number')
  t.is(level3string, 456)
})

test('Mutate field string to integer', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'aType',
    level1string: '1234.56',
    level1object: {
      level2object: {
        level3string: '456',
      },
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1string: { type: 'integer' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3string: {
                        type: 'integer',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        mode: SchemaUpdateMode.migration,
      }
    )
  )

  t.is(client.schema.types['aType'].fields['level1string'].type, 'integer')
  const {
    level1string,
    level1object: {
      level2object: { level3string },
    },
  } = await client.get({
    $id: id,
    level1string: true,
    level1object: true,
  })
  t.is(typeof level1string, 'number')
  t.is(level1string, 1235)
  t.is(typeof level3string, 'number')
  t.is(level3string, 456)
})
