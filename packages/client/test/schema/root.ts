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
    root: {
      fields: {
        aField: { type: 'string' },
      },
    },
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

test('Add new field to root', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema({
      root: {
        fields: {
          newField: { type: 'number' },
        },
      },
    })
  )

  const newSchema = client.schema
  // t.log(JSON.stringify(newSchema.root, null, 2))
  t.is(newSchema.root.fields['newField']?.type, 'number')
})

test('Change field in root', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        root: {
          fields: {
            aField: { type: 'number' },
          },
        },
      },
      {
        mode: SchemaUpdateMode.flexible,
      }
    )
  )

  const newSchema = client.schema
  t.is(newSchema.root.fields['aField']?.type, 'number')
})

test('Remove field in root', async (t) => {
  const { client } = t.context

  await t.notThrowsAsync(
    client.updateSchema(
      {
        root: {
          fields: {
            aField: { $delete: true },
          },
        },
      },
      {
        mode: SchemaUpdateMode.flexible,
      }
    )
  )

  const newSchema = client.schema
  t.false(newSchema.root.fields.hasOwnProperty('aField'))
})

test('Cannot delete root', async (t) => {
  const { client } = t.context

  await t.throwsAsync(
    client.updateSchema(
      {
        root: {
          $delete: true,
        },
      },
      {
        mode: SchemaUpdateMode.flexible,
      }
    ),
    {
      message: 'Cannot delete root.',
    }
  )
})
