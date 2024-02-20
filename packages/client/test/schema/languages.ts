import anyTest, { TestFn } from 'ava'
import getPort from 'get-port'
import { startOrigin, SelvaServer } from '@based/db-server'
import { BasedDbClient } from '../../src/index.js'
import '../assertions/index.js'
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
          level1string: { type: 'string' },
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

test('Changes existing languages', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema({
      language: 'de',
      translations: ['pt', 'it'],
      languageFallbacks: {
        pt: ['de'],
        it: ['it'],
      },
    })
  )

  const newSchema = client.schema
  t.is(newSchema.language, 'de')
  t.deepEqual(newSchema.translations, ['pt', 'it'])
  t.deepEqual(newSchema.languageFallbacks, {
    pt: ['de'],
    it: ['it'],
  })
})

test("Don't allow valid languages", async (t) => {
  const { client } = t.context
  await t.throwsAsync(
    client.updateSchema({
      // @ts-ignore
      language: '',
    }),
    { message: /^Invalid language "".$/ },
    "Language cannot be ''"
  )
  await t.throwsAsync(
    client.updateSchema({
      // @ts-ignore
      language: 'xx',
    }),
    {
      message: /^Invalid language "xx".$/,
    },
    'invalid language'
  )
  await t.throwsAsync(
    client.updateSchema({
      // @ts-ignore
      translations: ['xx'],
    }),
    {
      message: /^Invalid language "xx".$/,
    },
    'invalid language in translations'
  )
  await t.notThrowsAsync(
    client.updateSchema({
      translations: [],
    }),
    'empty translatiosn should work'
  )
  await t.throwsAsync(
    client.updateSchema({
      languageFallbacks: {
        // @ts-ignore
        xx: ['de'],
      },
    }),
    {
      message: /^Invalid language "xx".$/,
    },
    'invalid language as languageFallbacks key'
  )
  await t.throwsAsync(
    client.updateSchema({
      language: 'en',
      languageFallbacks: {
        // @ts-ignore
        de: ['de'],
      },
    }),
    {
      message: /^Language "de" cannot fallback to "de".$/,
    },
    'same language as key in languageFallbacks'
  )
  await t.throwsAsync(
    client.updateSchema({
      language: 'en',
      languageFallbacks: {
        // @ts-ignore
        de: ['xx'],
      },
    }),
    {
      message: /^Language "de" cannot fallback to "xx".$/,
    },
    'invalied language in languageFallbacks values'
  )
  await t.throwsAsync(
    client.updateSchema({
      language: 'en',
      languageFallbacks: {
        // @ts-ignore
        de: ['it', 'en'],
        nl: ['en'],
      },
    }),
    {
      message: /^Language "de" cannot fallback to "it".$/,
    },
    'language not configured in languageFallbacks values'
  )
})

test('Not touching languages should not fail', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        types: {
          aType: {
            fields: {
              level1string: { type: 'number' },
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
  t.is(newSchema.language, 'en')
  t.deepEqual(newSchema.translations, ['de', 'nl'])
})
