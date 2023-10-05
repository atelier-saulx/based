import anyTest, { TestInterface } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { DEFAULT_FIELDS } from '../src/schema'

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
                floatArray: { type: 'array', values: { type: 'number' } },
                intArray: { type: 'array', values: { type: 'integer' } },
                objArray: {
                  type: 'array',
                  values: {
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
          dingdongs: { type: 'array', values: { type: 'string' } },
          floatArray: { type: 'array', values: { type: 'number' } },
          intArray: { type: 'array', values: { type: 'integer' } },
          tsArray: { type: 'array', values: { type: 'timestamp' } },
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
  })

  t.context.client.unsubscribeSchema()
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test.serial('schema subs work implicitly', async (t) => {
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

  const e = await t.throwsAsync(
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

  const e = await t.throwsAsync(
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

// TODO: can this be allowed?
test('Should not allow to change the prefix of existing type', async (t) => {
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
      message: 'Cannot change prefix of existing type',
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
      message: 'Invalid field type nonExisting',
    }
  )
})

test('Array field type properties validation', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema({
      types: {
        aNewType: {
          prefix: 'ne',
          fields: {
            // @ts-ignore
            intArray: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
    }),
    {
      message: 'Wrong field passed for type array on schema (items)',
    }
  )
})

test('Only allow field type text if languages are defined', async (t) => {
  const port = await getPort()
  console.log('origin')
  const server = await startOrigin({
    port: port,
    name: 'default',
  })

  console.log('connecting')
  const client = new BasedDbClient()
  client.connect({
    port: port,
    host: '127.0.0.1',
  })
  client.subscribeSchema()

  console.log('updating schema')

  // TODO: find way to do this
  client.schema.languages = []
  await t.throwsAsync(
    client.updateSchema({
      languages: [],
      types: {
        textType: {
          prefix: 'te',
          fields: {
            textField: { type: 'text' },
          },
        },
      },
    }),
    {
      message:
        'Cannot use fields of type text without `languages` being defined`',
    }
  )

  client.unsubscribeSchema()

  await server.destroy()
  client.destroy()
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
  t.true(newSchema.types['matriarch'].prefix !== 'ma')
  t.true(newSchema.types['another'].prefix === 'an')
})

