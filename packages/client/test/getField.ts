import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port
test.beforeEach(async (t) => {
  port = await getPort()
  console.log('origin')
  srv = await startOrigin({
    port,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en', 'de', 'nl'],
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

test.after(async (t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

// TODO: when using $field original field stays in get query
test.serial.skip('get - simple alias', async (t) => {
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

test.serial(
  'get - $field with multiple options, taking the first',
  async (t) => {
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
  }
)

test.serial(
  'get - $field with multiple options, taking the second',
  async (t) => {
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
  }
)

// TODO: $inherit missing
test.serial.skip('get - simple $field with $inherit: true', async (t) => {
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

  const r = t.deepEqual(
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

// TODO: $inherit missing
test.serial.skip('get - simple $field with $inherit: $type', async (t) => {
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

test.serial('get - $field with object structure', async (t) => {
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
