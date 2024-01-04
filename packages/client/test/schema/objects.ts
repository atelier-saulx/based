import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src'
import { startOrigin, SelvaServer } from '@based/db-server'
import '../assertions'
import getPort from 'get-port'
import { SchemaUpdateMode } from '../../src/types'
import { BasedSchemaFieldObject } from '@based/schema'

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

test('Remove last property on object field', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          lekkerType: {
            fields: {
              ding: {
                properties: {
                  texty: {
                    $delete: true,
                  },
                  wawa: {
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

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          lekkerType: {
            fields: {
              ding: {
                properties: {
                  dung: {
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
      message:
        /^Cannot remove last property of object field "lekkerType.ding".$/,
    }
  )

  const newSchema = client.schema
  t.false(
    (
      newSchema.types['lekkerType'].fields.ding as BasedSchemaFieldObject
    ).properties.hasOwnProperty('texty')
  )
  t.false(
    (
      newSchema.types['lekkerType'].fields.ding as BasedSchemaFieldObject
    ).properties.hasOwnProperty('wawa')
  )
  t.true(
    (
      newSchema.types['lekkerType'].fields.ding as BasedSchemaFieldObject
    ).properties.hasOwnProperty('dung')
  )
})

test('Remove all properties on object field', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          lekkerType: {
            fields: {
              ding: {
                properties: {
                  texty: {
                    $delete: true,
                  },
                  wawa: {
                    $delete: true,
                  },
                  dung: {
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
      message:
        /^Cannot remove last property of object field "lekkerType.ding".$/,
    }
  )

  const newSchema = client.schema
  t.true(
    (
      newSchema.types['lekkerType'].fields.ding as BasedSchemaFieldObject
    ).properties.hasOwnProperty('texty')
  )
  t.true(
    (
      newSchema.types['lekkerType'].fields.ding as BasedSchemaFieldObject
    ).properties.hasOwnProperty('wawa')
  )
  t.true(
    (
      newSchema.types['lekkerType'].fields.ding as BasedSchemaFieldObject
    ).properties.hasOwnProperty('dung')
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

test('Change property on nested object field in flexible mode without exsiting nodes', async (t) => {
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

test('Add nested property flexible mode without exsiting nodes', async (t) => {
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
                      three: {
                        type: 'object',
                        properties: {
                          four: {
                            type: 'object',
                            properties: {
                              five: { type: 'number' },
                            },
                          },
                        },
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
      .properties['three'].properties['four'].properties['five'].type,
    'number'
  )
})

test('Add object field without properties should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        anotherType: {
          fields: {
            level1object: {
              type: 'object',
            },
          },
        },
      },
    }),
    {
      message:
        /^Field "anotherType.level1object" is of type "object" but does not include a valid "properties" property.$/,
    }
  )
})
