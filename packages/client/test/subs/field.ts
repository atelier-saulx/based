import anyTest, { TestInterface } from 'ava'
import { deepCopy, wait } from '@saulx/utils'
import { TestCtx, observe, startSubs } from '../assertions'
import { BasedSchemaPartial } from '@based/schema'

const test = anyTest as TestInterface<TestCtx>

const schema: BasedSchemaPartial = {
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
}

test.serial('subscribe - simple alias', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

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
  observe(
    t,
    {
      $id: 'viA',
      id: true,
      enTitle: {
        $field: 'title.en',
      },
      value: true,
    },
    (res) => {
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
})
