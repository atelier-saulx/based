import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src'
import { startOrigin } from '../../../server/dist'
import { SelvaServer } from '../../../server/dist/server'
import { wait } from '@saulx/utils'
import '../assertions'
import { getIndexingState } from '../assertions/utils'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from '../assertions'

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
    env: {
      FIND_INDICES_MAX: '1',
      FIND_INDEXING_INTERVAL: '10',
      FIND_INDEXING_ICB_UPDATE_INTERVAL: '1',
      FIND_INDEXING_POPULARITY_AVE_PERIOD: '1',
      FIND_INDEXING_THRESHOLD: '2',
    },
  })

  console.log('connecting')
  t.context.client = new BasedDbClient()
  t.context.client.connect({
    port: t.context.port,
    host: '127.0.0.1',
  })

  console.log('updating schema')
  await t.context.client.updateSchema({
    language: 'en',
    types: {
      thing: {
        prefix: 'th',
        fields: {
          name: { type: 'string' },
          subthings: { type: 'references' },
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

test.skip('find references', async (t) => {
  const { client } = t.context

  const mainThing = await client.set({
    type: 'thing',
    name: 'Main thing',
    subthings: [
      {
        type: 'thing',
        name: 'sub 1',
        subthings: [
          {
            type: 'thing',
            name: 'sub 2',
            subthings: [
              {
                type: 'thing',
                name: 'sub 3',
                subthings: [
                  {
                    type: 'thing',
                    name: 'sub 4',
                  },
                  {
                    type: 'thing',
                    name: 'sub 6',
                  },
                  {
                    type: 'thing',
                    name: 'sub 7',
                  },
                ],
              },
              {
                type: 'thing',
                name: 'sub 5',
              },
            ],
          },
          {
            type: 'thing',
            name: 'sub 8',
            subthings: [
              {
                type: 'thing',
                name: 'sub 10',
              },
            ],
          },
        ],
      },
      {
        type: 'thing',
        name: 'sub 9',
      },
    ],
  })

  const q = {
    $id: mainThing,
    items: {
      name: true,
      $list: {
        $find: {
          $traverse: 'subthings',
          $recursive: true,
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'thing',
            },
          ],
        },
      },
    },
  }

  for (let i = 0; i < 300; i++) {
    deepEqualIgnoreOrder(t, await client.get(q), {
      items: [
        { name: 'sub 1' },
        { name: 'sub 2' },
        { name: 'sub 3' },
        { name: 'sub 4' },
        { name: 'sub 5' },
        { name: 'sub 6' },
        { name: 'sub 7' },
        { name: 'sub 8' },
        { name: 'sub 9' },
        { name: 'sub 10' },
      ],
    })
    await wait(1)
  }

  const indState = await getIndexingState(client)
  t.deepEqual(indState[`${mainThing}.O.eyJzdWJ0aGluZ3MifQ==.InRoIiBl`].card, 10)
})
