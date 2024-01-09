import test from 'ava'
import { BasedDbClient } from '@based/db-client'
import { startOrigin } from '@based/db-server'
import { subscribe } from '../src/index.js'
import getPort from 'get-port'

test('subs', async (t) => {
  const port = await getPort()
  const dbOpts = {
    name: 'default',
    port,
    host: '127.0.0.1',
  }
  /* const server = */ startOrigin(dbOpts)
  const client = new BasedDbClient()

  client.connect(dbOpts)

  await client.updateSchema({
    language: 'en',
    translations: ['nl', 'de', 'fi'],
    prefixToTypeMapping: {
      po: 'post',
      me: 'meh',
    },
    root: {
      prefix: 'ro',
      fields: {
        id: { type: 'string' },
      },
    },
    types: {
      meh: {
        prefix: 'me',
        fields: {
          id: { type: 'string' },
          str: { type: 'string' },
          rec: {
            type: 'record',
            values: {
              type: 'object',
              properties: { a: { type: 'string' }, b: { type: 'number' } },
            },
          },
        },
      },
    },
  })

  let count = 0
  const promise = new Promise<void>((resolve) => {
    subscribe(
      client,
      {
        $id: 'root',
        children: {
          str: true,
          $list: true,
        },
      },
      async (_res: any) => {
        count++
        if (count === 10) {
          resolve()
        } else {
          client.set({
            type: 'meh',
            str: 'yes ' + count,
          })
        }
      }
    )
  })

  await promise

  t.pass()
})
