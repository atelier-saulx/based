import anyTest, { TestFn } from 'ava'
import getPort from 'get-port'
import { startOrigin, SelvaServer } from '@based/db-server'
import { BasedDbClient } from '../../src/index.js'
import '../assertions'
import { SchemaUpdateMode } from '../../src/types.js'

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
          level1number: {
            type: 'number',
          },
          level1integer: {
            type: 'integer',
          },
          level1string: {
            type: 'string',
          },
          level1text: {
            type: 'text',
          },
          level1object: {
            type: 'object',
            properties: {
              level2object: {
                type: 'object',
                properties: {
                  level3number: { type: 'number' },
                  level3integer: { type: 'integer' },
                  level3string: { type: 'string' },
                  level3text: { type: 'text' },
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

test('Mutate field number to integer', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'aType',
    level1number: 1234.56,
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
              level1number: { type: 'integer' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3number: {
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

  t.is(client.schema.types['aType'].fields['level1number'].type, 'integer')
  const {
    level1number,
    level1object: {
      level2object: { level3number },
    },
  } = await client.get({
    $id: id,
    level1number: true,
    level1object: true,
  })
  t.is(typeof level1number, 'number')
  t.is(level1number, 1235)
  t.is(typeof level3number, 'number')
  t.is(level3number, 456)
})

test('Mutate field integer to number', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'aType',
    level1integer: 1234,
    level1object: {
      level2object: {
        level3integer: 456,
      },
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1integer: { type: 'number' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3integer: {
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

  t.is(client.schema.types['aType'].fields['level1integer'].type, 'number')
  const {
    level1integer,
    level1object: {
      level2object: { level3integer },
    },
  } = await client.get({
    $id: id,
    level1integer: true,
    level1object: true,
  })
  t.is(typeof level1integer, 'number')
  t.is(level1integer, 1234)
  t.is(typeof level3integer, 'number')
  t.is(level3integer, 456)
})

test('Mutate field text to string', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'aType',
    level1text: {
      en: 'one',
      de: 'eins',
      nl: 'een',
    },
    level1object: {
      level2object: {
        level3text: {
          en: 'two',
          de: 'zwei',
          nl: 'twee',
        },
      },
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1text: { type: 'string' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3text: {
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

  t.is(client.schema.types['aType'].fields['level1text'].type, 'string')
  const {
    level1text,
    level1object: {
      level2object: { level3text },
    },
  } = await client.get({
    $id: id,
    level1text: true,
    level1object: true,
  })
  t.is(typeof level1text, 'string')
  t.is(level1text, 'one')
  t.is(typeof level3text, 'string')
  t.is(level3text, 'two')
})

test('Mutate field string to text', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'aType',
    level1string: 'one',
    level1object: {
      level2object: {
        level3string: 'two',
      },
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1string: { type: 'text' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3string: {
                        type: 'text',
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

  t.is(client.schema.types['aType'].fields['level1string'].type, 'text')
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
  const defaultLanguage = client.schema.language
  t.is(typeof level1string, 'object')
  t.deepEqual(level1string, { [defaultLanguage]: 'one' })
  t.is(typeof level3string, 'object')
  t.deepEqual(level3string, { [defaultLanguage]: 'two' })
})

test('Mutate field number to text', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'aType',
    level1number: 1234.56,
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
              level1number: { type: 'text' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3number: {
                        type: 'text',
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

  t.is(client.schema.types['aType'].fields['level1number'].type, 'text')
  const {
    level1number,
    level1object: {
      level2object: { level3number },
    },
  } = await client.get({
    $id: id,
    level1number: true,
    level1object: true,
  })
  const defaultLanguage = client.schema.language
  t.is(typeof level1number, 'object')
  t.deepEqual(level1number, { [defaultLanguage]: '1234.56' })
  t.is(typeof level3number, 'object')
  t.deepEqual(level3number, { [defaultLanguage]: '456' })
})

test('Mutate field text to number', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'aType',
    level1text: {
      en: '1234.56',
      de: '234.45',
      nl: '567.33',
    },
    level1object: {
      level2object: {
        level3text: {
          en: '456',
          de: '789',
          nl: '10023',
        },
      },
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1text: { type: 'number' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3text: {
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

  t.is(client.schema.types['aType'].fields['level1text'].type, 'number')
  const {
    level1text,
    level1object: {
      level2object: { level3text },
    },
  } = await client.get({
    $id: id,
    level1text: true,
    level1object: true,
  })
  t.is(typeof level1text, 'number')
  t.is(level1text, 1234.56)
  t.is(typeof level3text, 'number')
  t.is(level3text, 456)
})

test('Mutate field text to integer', async (t) => {
  const { client } = t.context

  const id = await client.set({
    type: 'aType',
    level1text: {
      en: '1234.84',
      de: '234.45',
      nl: '567.33',
    },
    level1object: {
      level2object: {
        level3text: {
          en: '456',
          de: '789',
          nl: '10023',
        },
      },
    },
  })

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1text: { type: 'integer' },
              level1object: {
                properties: {
                  level2object: {
                    properties: {
                      level3text: {
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

  t.is(client.schema.types['aType'].fields['level1text'].type, 'integer')
  const {
    level1text,
    level1object: {
      level2object: { level3text },
    },
  } = await client.get({
    $id: id,
    level1text: true,
    level1object: true,
  })
  t.is(typeof level1text, 'number')
  t.is(level1text, 1235)
  t.is(typeof level3text, 'number')
  t.is(level3text, 456)
})
