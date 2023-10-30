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
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      lekkerType: {
        prefix: 'vi',
        fields: {
          value: { type: 'number' },
          ding: {
            type: 'object',
            properties: {
              texty: { type: 'text' },
              wawa: { type: 'integer' },
              dung: { type: 'number' },
            },
          },
          withNested: {
            type: 'object',
            properties: {
              again: {
                type: 'object',
                properties: {
                  nestedString: { type: 'string' },
                  nestedInteger: { type: 'integer' },
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
                  // TODO: Remove when @based/schema is updated
                  // @ts-ignore
                  $delete: true,
                },
              },
            },
          },
        },
      },
    }),
    {
      message: /^Cannot remove "lekkerType.ding.dung" in strict mode.$/,
    }
  )
})

test('Remove property on nested object field in strict mode', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        lekkerType: {
          fields: {
            withNested: {
              properties: {
                again: {
                  properties: {
                    nestedString: {
                      // TODO: Remove when @based/schema is updated
                      // @ts-ignore
                      $delete: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    {
      message:
        /^Cannot remove "lekkerType.withNested.again.nestedString" in strict mode.$/,
    }
  )
})

test('Remove property on object field in flexible mode with exsiting nodes', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'lekkerType',
    ding: {
      dung: 123,
    },
  })

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          lekkerType: {
            fields: {
              ding: {
                properties: {
                  dung: {
                    // TODO: Remove when @based/schema is updated
                    // @ts-ignore
                    $delete: true,
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
      message: /^Cannot mutate ".*?" in flexible mode with exsiting data.$/,
    }
  )
})

test('Remove property on object field in flexible mode with exsiting nodes but unused property', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'lekkerType',
    ding: {
      wawa: 123,
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          lekkerType: {
            fields: {
              ding: {
                properties: {
                  dung: {
                    // TODO: Remove when @based/schema is updated
                    // @ts-ignore
                    $delete: true,
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
})

test('Remove property on object field in flexible mode without exsiting nodes', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          lekkerType: {
            fields: {
              ding: {
                properties: {
                  dung: {
                    // TODO: Remove when @based/schema is updated
                    // @ts-ignore
                    $delete: true,
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
  t.false(
    // @ts-ignore
    newSchema.types['lekkerType'].fields.ding?.properties.hasOwnProperty(
      'title'
    )
  )
})

test('Change property on object field in strict mode', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        lekkerType: {
          fields: {
            ding: {
              properties: {
                dung: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    }),
    {
      message: /^Cannot change "lekkerType.ding.dung" in strict mode.$/,
    }
  )
})

test('Change property on object field in flexible mode with exsiting nodes', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'lekkerType',
    ding: {
      dung: 123,
    },
  })

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          lekkerType: {
            fields: {
              ding: {
                properties: {
                  dung: { type: 'string' },
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
      message: /^Cannot mutate ".*?" in flexible mode with exsiting data.$/,
    }
  )
})

test('Change property on object field in flexible mode with exsiting nodes but unused property', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'lekkerType',
    ding: {
      wawa: 123,
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          lekkerType: {
            fields: {
              ding: {
                properties: {
                  dung: { type: 'string' },
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
  t.is(
    // @ts-ignore
    newSchema.types['lekkerType'].fields['ding'].properties['dung'].type,
    'string'
  )
})

test.only('Change property on nested object field in flexible mode without exsiting nodes', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          lekkerType: {
            fields: {
              withNested: {
                properties: {
                  again: {
                    properties: {
                      nestedString: {
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
        mode: SchemaUpdateMode.flexible,
      }
    )
  )

  const newSchema = client.schema
  t.is(
    // @ts-ignore
    newSchema.types['lekkerType'].fields['withNested'].properties['again']
      .properties['nestedString'].type,
    'number'
  )
})
