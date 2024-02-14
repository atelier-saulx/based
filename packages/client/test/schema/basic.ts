import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src/index.js'
import { SelvaServer, startOrigin } from '@based/db-server'
import { wait } from '@saulx/utils'
import '../assertions/index.js'
import getPort from 'get-port'
import { SchemaUpdateMode } from '../../src/types.js'
import { DEFAULT_FIELDS } from '../../src/schema/mergeSchema.js'
import { BasedSchemaPartial } from '@based/schema'

const test = anyTest as TestFn<{
  srv: SelvaServer
  client: BasedDbClient
  port: number
}>

const startingSchema: BasedSchemaPartial = {
  language: 'en',
  translations: ['de', 'nl'],
  root: {
    fields: {
      value: { type: 'number' },
      nested: {
        type: 'object',
        properties: {
          fun: { type: 'string' },
        },
      },
    },
  },
  types: {
    lekkerType: {
      prefix: 'vi',
      fields: {
        strRec: {
          type: 'record',
          values: {
            type: 'string',
          },
        },
        textRec: {
          type: 'record',
          values: {
            type: 'text',
          },
        },
        objRec: {
          type: 'record',
          values: {
            type: 'object',
            properties: {
              floatArray: { type: 'array', items: { type: 'number' } },
              intArray: { type: 'array', items: { type: 'integer' } },
              objArray: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    hello: { type: 'string' },
                    value: { type: 'integer' },
                    fvalue: { type: 'number' },
                  },
                },
              },
              hello: {
                type: 'string',
              },
              nestedRec: {
                type: 'record',
                values: {
                  type: 'object',
                  properties: {
                    value: {
                      type: 'number',
                    },
                    hello: {
                      type: 'string',
                    },
                  },
                },
              },
              value: {
                type: 'number',
              },
              stringValue: {
                type: 'string',
              },
            },
          },
        },
        thing: { type: 'set', items: { type: 'string' } },
        ding: {
          type: 'object',
          properties: {
            dong: { type: 'set', items: { type: 'string' } },
            texty: { type: 'text' },
            dung: { type: 'number' },
            dang: {
              type: 'object',
              properties: {
                dung: { type: 'number' },
                dunk: { type: 'string' },
              },
            },
            dunk: {
              type: 'object',
              properties: {
                ding: { type: 'number' },
                dong: { type: 'number' },
              },
            },
          },
        },
        dong: { type: 'json' },
        dingdongs: { type: 'array', items: { type: 'string' } },
        floatArray: { type: 'array', items: { type: 'number' } },
        intArray: { type: 'array', items: { type: 'integer' } },
        tsArray: { type: 'array', items: { type: 'timestamp' } },
        refs: { type: 'references' },
        value: { type: 'number' },
        age: { type: 'number' },
        auth: {
          type: 'json',
        },
        title: { type: 'text' },
        description: { type: 'text' },
        image: {
          type: 'object',
          properties: {
            thumb: { type: 'string' },
            poster: { type: 'string' },
          },
        },
      },
    },
    custom: {
      prefix: 'cu',
      fields: {
        name: { type: 'string' },
        value: { type: 'number' },
        age: { type: 'number' },
        auth: {
          type: 'json',
        },
        title: { type: 'text' },
        description: { type: 'text' },
        image: {
          type: 'object',
          properties: {
            thumb: { type: 'string' },
            poster: { type: 'string' },
          },
        },
      },
    },
    club: {
      prefix: 'cl',
      fields: {
        value: { type: 'number' },
        age: { type: 'number' },
        auth: {
          type: 'json',
        },
        title: { type: 'text' },
        description: { type: 'text' },
        image: {
          type: 'object',
          properties: {
            thumb: { type: 'string' },
            poster: { type: 'string' },
          },
        },
      },
    },
    match: {
      prefix: 'ma',
      fields: {
        title: { type: 'text' },
        value: { type: 'number' },
        description: { type: 'text' },
      },
    },
    yesno: {
      prefix: 'yn',
      fields: {
        bolYes: { type: 'boolean' },
        bolNo: { type: 'boolean' },
      },
    },
  },
}

test.beforeEach(async (t) => {
  t.timeout(5000)
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

  await t.context.client.updateSchema(startingSchema)

  t.context.client.unsubscribeSchema()
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('schema subs work implicitly', async (t) => {
  const { client } = t.context
  const otherClient = new BasedDbClient()
  otherClient.connect({
    host: '127.0.0.1',
    port: t.context.port,
  })
  otherClient.subscribeSchema()

  await client.updateSchema({
    types: {
      boom: {
        prefix: 'bo',
        fields: {
          hello: { type: 'string' },
        },
      },
    },
  })

  await wait(5e3)

  t.deepEqual(client.schema.types.boom, {
    prefix: 'bo',
    fields: {
      hello: { type: 'string' },
      ...DEFAULT_FIELDS,
    },
  })
  t.deepEqual(client.schema, otherClient.schema)

  otherClient.unsubscribeSchema()
  otherClient.destroy()
})

test('Creating an already used prefix', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        flurpydurpy: {
          prefix: 'ma',
          fields: {
            niceStrField: { type: 'string' },
          },
        },
      },
    }),
    {
      message: 'Prefix ma is already in use',
    }
  )
})

test('Keeping the same prefix of a type should not fail', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema({
      types: {
        match: {
          prefix: 'ma',
          fields: {
            title: { type: 'text' },
          },
        },
      },
    })
  )
})

test('Adding a type with `ro` prefix should fail because of `root`', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        anotherRoot: {
          prefix: 'ro',
          fields: {
            niceStrField: { type: 'string' },
          },
        },
      },
    }),
    {
      message: 'Prefix ro is already in use',
    }
  )
})

test('Should not allow to change the prefix of existing type in strict mode', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'match',
    title: {
      en: 'this is title',
    },
  })

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          match: {
            prefix: 'me',
            fields: {
              title: { type: 'text' },
            },
          },
        },
      },
      {
        mode: SchemaUpdateMode.flexible,
      }
    ),
    {
      message: /^Cannot mutate "match" in flexible mode with exsiting data.$/,
    }
  )
})

test('Should not allow to change the prefix in flexible mode if there exist nodes', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        match: {
          prefix: 'me',
          fields: {
            title: { type: 'text' },
          },
        },
      },
    }),
    {
      message: /^Cannot change "match" in strict mode.$/,
    }
  )
})

test('Should not allow to create invalid type', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aNewType: {
          prefix: 'ne',
          fields: {
            // @ts-ignore
            title: { type: 'nonExisting' },
          },
        },
      },
    }),
    {
      message: 'Invalid field type "nonExisting" on "aNewType.title"',
    }
  )
})

test('Default prefix should not be an existing one', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema({
      types: {
        matriarch: {
          fields: {
            title: { type: 'text' },
          },
        },
        another: {
          fields: {
            title: { type: 'text' },
          },
        },
      },
    })
  )

  // TODO: is this a direct property of going to be a method?
  const newSchema = client.schema
  t.not(newSchema.types['matriarch'].prefix, 'ma')
  t.is(newSchema.types['another'].prefix, 'an')
})

test('Change field type in strict mode should fail', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        match: {
          fields: {
            title: { type: 'string' },
          },
        },
      },
    }),
    {
      message: /^Cannot change "match.title" in strict mode.$/,
    }
  )
})

test('Change field type in flexible mode without any nodes', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          match: {
            fields: {
              title: { type: 'string' },
            },
          },
        },
      },
      { mode: SchemaUpdateMode.flexible }
    )
  )
  const newSchema = client.schema
  t.true(newSchema.types['match'].fields?.title?.type === 'string')
})

test('Change field type in flexible mode with existing nodes', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'match',
    title: {
      en: 'this is title',
    },
  })

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          match: {
            fields: {
              title: { type: 'string' },
            },
          },
        },
      },
      { mode: SchemaUpdateMode.flexible }
    ),
    {
      message:
        /^Cannot mutate "match.title" in flexible mode with exsiting data.$/,
    }
  )
})

test('Remove field in strict mode', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        match: {
          fields: {
            title: { $delete: true },
          },
        },
      },
    }),
    {
      message: /^Cannot remove "match.title" in strict mode.$/,
    }
  )
})

test('Remove field in flexible mode without exisitng nodes', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          match: {
            fields: {
              title: { $delete: true },
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
  t.false(newSchema.types['match'].fields.hasOwnProperty('title'))
})

test('Remove field in flexible mode withexisitng nodes', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'match',
    title: {
      en: 'this is title',
    },
  })

  await t.throwsAsync(
    client.updateSchema(
      {
        types: {
          match: {
            fields: {
              title: { $delete: true },
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
        /^Cannot mutate "match.title" in flexible mode with exsiting data.$/,
    }
  )
})

test('Remove type in strict mode', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        match: {
          $delete: true,
        },
      },
    }),
    {
      message: /^Cannot remove "match" in strict mode.$/,
    }
  )
})

test('Remove type in flexible mode without existing nodes', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          match: {
            $delete: true,
          },
        },
      },
      {
        mode: SchemaUpdateMode.flexible,
      }
    )
  )
  const newSchema = client.schema
  t.false(newSchema.types.hasOwnProperty('match'))
})

test('Remove type in migration mode', async (t) => {
  const { client } = t.context

  const sets: Promise<string>[] = []
  for (let i = 0; i < 7000; i++) {
    sets.push(
      client.set({
        type: 'match',
        value: i,
      })
    )
  }
  for (let i = 0; i < 1000; i++) {
    sets.push(
      client.set({
        type: 'club',
        value: i,
      })
    )
  }
  await Promise.all(sets)

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          match: {
            $delete: true,
          },
        },
      },
      {
        mode: SchemaUpdateMode.migration,
      }
    )
  )

  const { count: countMatches } = await client.get({
    count: {
      $aggregate: {
        $function: 'count',
        $traverse: 'descendants',
        $filter: [
          {
            $field: 'type',
            $operator: '=',
            $value: 'match',
          },
        ],
      },
    },
  })
  t.is(countMatches, 0)

  const { count: countClubs } = await client.get({
    count: {
      $aggregate: {
        $function: 'count',
        $traverse: 'descendants',
        $filter: [
          {
            $field: 'type',
            $operator: '=',
            $value: 'club',
          },
        ],
      },
    },
  })
  t.is(countClubs, 1000)
})

test('Change remove field in migration mode', async (t) => {
  const { client } = t.context

  const sets: Promise<string>[] = []
  for (let i = 0; i < 7000; i++) {
    sets.push(
      client.set({
        type: 'match',
        value: i,
      })
    )
  }
  const ids = await Promise.all(sets)

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          match: {
            fields: {
              value: {
                $delete: true,
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
  t.false(
    (
      await client.get({ $id: ids[ids.length - 23], $all: true })
    ).hasOwnProperty('value')
  )
})

test('Delete defaults should fail', async (t) => {
  const { client } = t.context

  for (const fieldName in DEFAULT_FIELDS) {
    await t.throwsAsync(
      client.updateSchema(
        {
          types: {
            match: {
              fields: {
                [fieldName]: { $delete: true },
              },
            },
          },
        },
        {
          mode: SchemaUpdateMode.migration,
        }
      ),
      {
        message: new RegExp(`^Cannot change default field "${fieldName}".$`),
      }
    )
  }
})

test('Change defaults should fail', async (t) => {
  const { client } = t.context

  for (const fieldName in DEFAULT_FIELDS) {
    await t.throwsAsync(
      client.updateSchema(
        {
          types: {
            match: {
              fields: {
                [fieldName]: { type: 'number' },
              },
            },
          },
        },
        {
          mode: SchemaUpdateMode.migration,
        }
      ),
      {
        message: new RegExp(`^Cannot change default field "${fieldName}".$`),
      }
    )
  }
})

test('Change defaults when adding new type should fail', async (t) => {
  const { client } = t.context

  for (const _fieldName in DEFAULT_FIELDS) {
    await t.throwsAsync(
      client.updateSchema(
        {
          types: {
            newType: {
              fields: {
                id: { type: 'number' },
                createdAt: { type: 'number' },
              },
            },
          },
        },
        {
          mode: SchemaUpdateMode.migration,
        }
      ),
      {
        message: /^Cannot change default field "id|createdAt".$/,
      }
    )
  }
})

test('Setting the same schema in default mode should not fail', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(client.updateSchema(startingSchema))
})
