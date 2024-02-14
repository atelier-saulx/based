import { deepCopy, wait } from '@saulx/utils'
import { basicTest } from './assertions/index.js'
import { destroySubscriber, subscribe } from '../src/index.js'

const test = basicTest({
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
        dingdongs: { type: 'array', items: { type: 'string' } },
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

test('subscribe - simple alias', async (t) => {
  const client = t.context.client

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

  const results: any[] = []
  subscribe(
    client,
    {
      $id: 'viA',
      id: true,
      enTitle: {
        $field: 'title.en',
      },
      value: true,
    },
    (res: any) => {
      results.push(deepCopy(res))
    }
  )

  await wait(500)
  t.deepEqual(results, [
    {
      id: 'viA',
      enTitle: 'nice!',
      value: 25,
    },
  ])

  await client.set({
    $id: 'viA',
    title: {
      en: 'better!',
    },
  })

  await wait(500)
  t.deepEqual(results, [
    {
      id: 'viA',
      enTitle: 'nice!',
      value: 25,
    },
    {
      id: 'viA',
      enTitle: 'better!',
      value: 25,
    },
  ])
  destroySubscriber(client)
})
