import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from './assertions/index.js'

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
    types: {
      actor: {
        prefix: 'ac',
        fields: {
          name: { type: 'string' },
          born: { type: 'integer' },
          died: { type: 'integer' },
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

test('get value without hyphen', async (t) => {
  const { client } = t.context
  await Promise.all(
    [
      {
        name: 'Charlton Heston',
        born: 1923,
        died: 2008,
      },
      {
        name: 'Leigh TaylorYoung',
        born: 1945,
      },
    ].map((actor) =>
      client.set({
        type: 'actor',
        ...actor,
      })
    )
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              { $field: 'type', $operator: '=', $value: 'actor' },
              { $field: 'name', $operator: '=', $value: 'Leigh TaylorYoung' },
            ],
          },
        },
      },
    }),
    {
      items: [{ name: 'Leigh TaylorYoung' }],
    }
  )
})

test('get value with hyphen', async (t) => {
  const { client } = t.context
  await Promise.all(
    [
      {
        name: 'Charlton Heston',
        born: 1923,
        died: 2008,
      },
      {
        name: 'Leigh Taylor-Young',
        born: 1945,
      },
    ].map((actor) =>
      client.set({
        type: 'actor',
        ...actor,
      })
    )
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              { $field: 'type', $operator: '=', $value: 'actor' },
              { $field: 'name', $operator: '=', $value: 'Leigh Taylor-Young' },
            ],
          },
        },
      },
    }),
    {
      items: [{ name: 'Leigh Taylor-Young' }],
    }
  )
})
