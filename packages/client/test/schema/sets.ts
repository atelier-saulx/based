import anyTest, { TestFn } from 'ava'
import getPort from 'get-port'
import { startOrigin, SelvaServer } from '@based/db-server'
import { BasedDbClient } from '../../src/index.js'
import '../assertions'
import { SchemaUpdateMode } from '../../src/types.js'
import { BasedSchemaFieldSet } from '@based/schema'

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
          level1set: {
            type: 'set',
            items: { type: 'string' },
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

test('Remove set field in strick mode should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            level1set: { $delete: true },
          },
        },
      },
    }),
    {
      message: /^Cannot remove "aType.level1set" in strict mode.$/,
    }
  )
})

test('Remove set field in flexible mode with exsiting nodes should fail', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'aType',
    level1set: ['one', 'two', 'three'],
  })

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1set: { $delete: true },
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
        /^Cannot mutate "aType.level1set" in flexible mode with exsiting data.$/,
    }
  )
})

test('Change set field in strick mode should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            level1set: { type: 'string' },
          },
        },
      },
    }),
    {
      message: /^Cannot change "aType.level1set" in strict mode.$/,
    }
  )

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aType: {
          fields: {
            level1set: {
              items: { type: 'number' },
            },
          },
        },
      },
    }),
    {
      message: /^Cannot change "aType.level1set" in strict mode.$/,
    }
  )
})

test('Change set field in flexible mode with existing nodes should fail', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'aType',
    level1set: ['one', 'two', 'three'],
  })

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1set: { type: 'string' },
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
        /^Cannot mutate "aType.level1set" in flexible mode with exsiting data.$/,
    }
  )

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1set: {
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
        /^Cannot mutate "aType.level1set" in flexible mode with exsiting data.$/,
    }
  )
})

test('Change set field in flexible mode without existing nodes should fail', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1set: {
                items: { type: 'number' },
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

  let newSchema = client.schema
  t.is(
    (newSchema.types['aType'].fields['level1set'] as BasedSchemaFieldSet).items
      .type,
    'number'
  )

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1set: { type: 'string' },
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
  t.is(newSchema.types['aType'].fields['level1set'].type, 'string')
})

test('Add set field without items should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        anotherType: {
          fields: {
            level1set: {
              type: 'set',
            },
          },
        },
      },
    }),
    {
      message:
        /^Field "anotherType.level1set" is of type "set" but does not include a valid "items" property.$/,
    }
  )
})
