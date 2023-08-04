import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (_t) => {
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
    languages: ['en', 'de', 'nl'],
    root: {
      fields: {
        ref: { type: 'reference' },
      },
    },
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          ref: { type: 'reference' },
        },
      },
    },
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

// TODO: set parse issue (Jim)
test.serial.only('implicitly created nodes', async (t) => {
  await client.set({
    $id: 'root',
    children: ['ma1', 'ma2'],
    ref: 'ma3',
  })
  await client.set({
    $id: 'ma5',
    ref: {
      $id: 'ma6',
      ref: 'ma4',
    },
    children: [
      {
        $id: 'ma7',
      },
    ],
  })

  t.deepEqual(
    await client.get({
      ref: {
        id: true,
        type: true,
      },
      matches: {
        id: true,
        type: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
            ],
          },
        },
      },
    }),
    {
      matches: [
        { id: 'ma1', type: 'match' },
        { id: 'ma2', type: 'match' },
        { id: 'ma5', type: 'match' },
        { id: 'ma6', type: 'match' },
        { id: 'ma7', type: 'match' },
      ],
      ref: { id: 'ma3', type: 'match' },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'ma5',
      id: true,
      type: true,
      children: {
        id: true,
        type: true,
        $list: {
          $find: {
            $traverse: 'children',
          },
        },
      },
      ref: {
        id: true,
        type: true,
      },
    }),
    {
      id: 'ma5',
      type: 'match',
      children: [{ id: 'ma7', type: 'match' }],
      ref: { id: 'ma6', type: 'match' },
    }
  )
})
