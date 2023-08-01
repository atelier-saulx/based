import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (t) => {
  console.log('origin')
  srv = await startOrigin({
    port: 8081,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en'],
    types: {
      glurp: {
        prefix: 'gl',
        fields: {
          levelCnt: { type: 'number' },
          title: { type: 'string' },
        },
      },
    },
  })
})

test.after(async (_t) => {
  await srv.destroy()
  client.destroy()
})

// TODO: waiting for creating node directly when setting children
test.serial.skip('get in keys result', async (t) => {
  await client.set({
    $id: 'root',
    children: [
      {
        type: 'glurp',
        $id: 'gl0',
        title: 'cookie',
      },
      {
        type: 'glurp',
        $id: 'gl1',
        title: 'glurpie pants',
      },
      {
        type: 'glurp',
        $id: 'gl2',
        title: 'glurpie pants 2',
      },
      {
        type: 'glurp',
        $id: 'gl3',
        title: 'cookie',
      },
    ],
  })

  const gimme = await client.get({
    flap: {
      title: true,
      id: true,
      $list: {
        $find: {
          $traverse: ['gl0', 'gl1', 'gl2'],
          $filter: {
            $field: 'title',
            $operator: '=',
            $value: 'cookie',
          },
        },
      },
    },
  })

  console.log({ gimme })

  t.deepEqual(gimme, { flap: [{ title: 'cookie', id: 'gl0' }] })
})
