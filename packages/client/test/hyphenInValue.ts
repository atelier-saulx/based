import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
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
    // languages: ['en'],
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

test.after(async (_t) => {
  await srv.destroy()
  client.destroy()
})

test.serial('get value without hyphen', async (t) => {
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

  t.deepEqualIgnoreOrder(
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

test.serial('get value with hyphen', async (t) => {
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

  t.deepEqualIgnoreOrder(
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
