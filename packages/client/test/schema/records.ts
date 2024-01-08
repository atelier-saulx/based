import anyTest, { TestFn } from 'ava'
import getPort from 'get-port'
import { startOrigin, SelvaServer } from '@based/db-server'
import { BasedDbClient } from '../../src/index.js'
import '../assertions/index.js'
import { SchemaUpdateMode } from '../../src/types.js'
import { BasedSchemaFieldObject, BasedSchemaFieldRecord } from '@based/schema'

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
  t.context.client.subscribeSchema()

  console.log('updating schema')

  await t.context.client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      aType: {
        prefix: 'at',
        fields: {
          level1record: {
            type: 'record',
            values: { type: 'number' },
          },
        },
      },
      bType: {
        fields: {
          level1record: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                level2object: {
                  type: 'object',
                  properties: {
                    level3string: { type: 'string' },
                  },
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

test('Remove record field in strick mode should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            level1record: { $delete: true },
          },
        },
      },
    }),
    {
      message: /^Cannot remove "aType.level1record" in strict mode.$/,
    }
  )
})

test('Remove record field in flexible mode with exsiting nodes should fail', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'aType',
    level1record: {
      rec1: 1,
      rec2: 2,
    },
  })

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1record: { $delete: true },
            },
          },
        },
      },
      {
        mode: SchemaUpdateMode.flexible,
      }
    ),
    {
      message:
        /^Cannot mutate "aType.level1record" in flexible mode with exsiting data.$/,
    }
  )
})

test('Change record field in strick mode should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            level1record: { type: 'string' },
          },
        },
      },
    }),
    {
      message: /^Cannot change "aType.level1record" in strict mode.$/,
    }
  )

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            level1record: {
              values: { type: 'number' },
            },
          },
        },
      },
    }),
    {
      message: /^Cannot change "aType.level1record" in strict mode.$/,
    }
  )
})

test('Change record field in flexible mode with existing nodes should fail', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'aType',
    level1record: {
      rec1: 1,
      rec2: 2,
    },
  })

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1record: { type: 'string' },
            },
          },
        },
      },
      {
        mode: SchemaUpdateMode.flexible,
      }
    ),
    {
      message:
        /^Cannot mutate "aType.level1record" in flexible mode with exsiting data.$/,
    }
  )

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1record: {
                items: { type: 'number' },
              },
            },
          },
        },
      },
      {
        mode: SchemaUpdateMode.flexible,
      }
    ),
    {
      message:
        /^Cannot mutate "aType.level1record" in flexible mode with exsiting data.$/,
    }
  )
})

test('Change record field in flexible mode without existing nodes should fail', async (t) => {
  const { client } = t.context

  // await t.notThrowsAsync(
  await client.updateSchema(
    {
      types: {
        aType: {
          fields: {
            level1record: {
              values: { type: 'string' },
            },
          },
        },
      },
    },
    {
      mode: SchemaUpdateMode.flexible,
    }
    // )
  )

  let newSchema = client.schema
  t.is(
    (newSchema.types['aType'].fields['level1record'] as BasedSchemaFieldRecord)
      .values.type,
    'string'
  )

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1record: { type: 'string' },
            },
          },
        },
      },
      {
        mode: SchemaUpdateMode.flexible,
      }
    )
  )

  newSchema = client.schema
  t.is(newSchema.types['aType'].fields['level1record'].type, 'string')
})

test('Add record field without values should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        anotherType: {
          fields: {
            level1record: {
              type: 'record',
            },
          },
        },
      },
    }),
    {
      message:
        /^Field "anotherType.level1record" is of type "record" but does not include a valid "values" property.$/,
    }
  )
})

test('Remove last property on object value on record', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          bType: {
            fields: {
              level1record: {
                values: {
                  type: 'object',
                  properties: {
                    level2object: {
                      type: 'object',
                      properties: {
                        level3string: { $delete: true },
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
        mode: SchemaUpdateMode.flexible,
      }
    ),
    {
      message:
        /^Cannot remove last property of object field "bType.level1record.level2object".$/,
    }
  )

  const newSchema = client.schema
  t.true(
    (
      (
        (
          newSchema.types['bType'].fields[
            'level1record'
          ] as BasedSchemaFieldRecord
        ).values as BasedSchemaFieldObject
      ).properties['level2object'] as BasedSchemaFieldObject
    ).properties.hasOwnProperty('level3string')
  )
})

test('Add nested object property on a record value', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          bType: {
            fields: {
              level1record: {
                values: {
                  type: 'object',
                  properties: {
                    level2object: {
                      type: 'object',
                      properties: {
                        level3string: { type: 'number' },
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
        mode: SchemaUpdateMode.flexible,
      }
    )
  )

  const newSchema = client.schema
  t.deepEqual(
    (
      (
        (
          newSchema.types['bType'].fields[
            'level1record'
          ] as BasedSchemaFieldRecord
        ).values as BasedSchemaFieldObject
      ).properties['level2object'] as BasedSchemaFieldObject
    ).properties['level3string'],
    { type: 'number' }
  )
})
