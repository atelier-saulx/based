import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'

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

  console.log('updating schema')

  await t.context.client.updateSchema({
    language: 'en',
    translations: ['de', 'nl'],
    types: {
      lekkerType: {
        prefix: 'vi',
        fields: {
          name: { type: 'string' },
          nice: {
            type: 'object',
            properties: {
              ecin: { type: 'string' },
              complexNice: {
                type: 'object',
                properties: { lekkerType: { type: 'json' } },
              },
            },
          },
          lekkerType: {
            type: 'object',
            properties: { thingydingy: { type: 'string' } },
          },
          thing: { type: 'set', items: { type: 'string' } },
          ding: {
            type: 'object',
            properties: {
              dong: { type: 'set', items: { type: 'string' } },
            },
          },
          dong: { type: 'json' },
          dingdongs: { type: 'array', values: { type: 'string' } },
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
          description: { type: 'text' },
        },
      },
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('get - simple alias', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viA',
    title: {
      en: 'nice!',
    },
    value: 25,
    auth: {
      // role needs to be different , different roles per scope should be possible
      role: {
        id: ['root'],
        type: 'admin',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viA',
      id: true,
      enTitle: {
        $field: 'title.en',
      },
      value: true,
    }),
    {
      id: 'viA',
      enTitle: 'nice!',
      value: 25,
    }
  )
})

test('get - $field with multiple options, taking the first', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viE',
    title: {
      en: 'nice',
    },
    value: 25,
    auth: {
      // role needs to be different , different roles per scope should be possible
      role: {
        id: ['root'],
        type: 'admin',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viE',
      id: true,
      valueOrAge: { $field: ['value', 'age'] },
    }),
    {
      id: 'viE',
      valueOrAge: 25,
    }
  )
})

test('get - $field with multiple options, taking the second', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viF',
    title: {
      en: 'nice',
    },
    age: 62,
    auth: {
      // role needs to be different , different roles per scope should be possible
      role: {
        id: ['root'],
        type: 'admin',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viF',
      id: true,
      valueOrAge: { $field: ['value', 'age'] },
    }),
    {
      id: 'viF',
      valueOrAge: 62,
    }
  )
})

test('get - simple $field with $inherit: true', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viH',
    title: {
      en: 'extranice',
      de: 'Ja, auf Deutsch',
    },
    nice: { complexNice: {} },
    lekkerType: {
      thingydingy: 'Thing-y Ding-y',
    },
    age: 62,
    auth: {
      // role needs to be different , different roles per scope should be possible
      role: {
        id: ['root'],
        type: 'admin',
      },
    },
  })

  await client.set({
    $id: 'viI',
    title: {
      en: 'nice',
    },
    parents: ['viH'],
    age: 62,
    auth: {
      // role needs to be different , different roles per scope should be possible
      role: {
        id: ['root'],
        type: 'admin',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viI',
      id: true,
      germanTitle: {
        $field: 'title.de',
        $inherit: true,
      },
    }),
    {
      id: 'viI',
      germanTitle: 'Ja, auf Deutsch',
    }
  )
})

test('get - simple $field with $inherit: $type', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'cuA',
    name: 'customA',
    title: {
      en: 'extraextranice',
      de: 'Ja, auf Deutsch 2',
    },
  })

  await client.set({
    $id: 'viJ',
    name: 'lekkerJ',
    title: {
      en: 'extranice',
      de: 'Ja, auf Deutsch',
    },
    parents: ['cuA'],
  })

  await client.set({
    $id: 'viK',
    title: {
      en: 'nice',
    },
    parents: ['viJ'],
    age: 62,
    auth: {
      // role needs to be different , different roles per scope should be possible
      role: {
        id: ['root'],
        type: 'admin',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viK',
      id: true,
      germanTitle: {
        $field: 'title.de',
        $inherit: { $type: 'custom' },
      },
    }),
    {
      id: 'viK',
      germanTitle: 'Ja, auf Deutsch 2',
    }
  )
})

test('get - $field with object structure', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viA',
    title: {
      en: 'nice!',
    },
    value: 25,
    auth: {
      // role needs to be different , different roles per scope should be possible
      role: {
        id: ['root'],
        type: 'admin',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viA',
      id: true,
      wrappingObject: {
        de: {
          $field: 'title.de',
        },
      },
      value: true,
    }),
    {
      id: 'viA',
      value: 25,
    }
  )
})
