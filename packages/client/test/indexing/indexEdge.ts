import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
import '../assertions/index.js'
import { getIndexingState } from '../assertions/utils.js'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from '../assertions/index.js'

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
      SELVA_INDEX_MAX: '1',
      SELVA_INDEX_INTERVAL: '10',
      SELVA_INDEX_ICB_UPDATE_INTERVAL: '1',
      SELVA_INDEX_POPULARITY_AVE_PERIOD: '1',
      SELVA_INDEX_THRESHOLD: '0',
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

// TODO The final index is something we didn't expect
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

  //console.dir(await client.command('index.debug', []), { depth: 100 })

  const indState = await getIndexingState(client)
  //console.log(indState);
  t.deepEqual(indState[`${mainThing}.O.eyJzdWJ0aGluZ3MifQ==.InRoIiBl`].card, 10)
})

test('find ref has filter', async (t) => {
  const { client } = t.context

  await client.set({
    $id: 'root',
    children: [
      {
        $id: 'tha',
        name: 'Main thing A',
        subthings: [
          {
            $id: 'th1',
            name: 'sub 1',
          },
          {
            $id: 'th2',
            name: 'sub 2',
          },
          {
            $id: 'th3',
            name: 'sub 3',
          },
          {
            $id: 'th4',
            name: 'sub 4',
          },
        ]
      },
      {
          $id: 'thb',
          name: 'Main thing B',
          subthings: [
          {
            $id: 'th5',
            name: 'sub 5',
          },
          {
            $id: 'th6',
            name: 'sub 6',
          },
          {
            $id: 'th7',
            name: 'sub 7',
          },
          {
            $id: 'th8',
            name: 'sub 8',
          },
        ],
      },
      {
          $id: 'thc',
          name: 'Main thing C',
          subthings: [
          {
            $id: 'th8',
            name: 'sub 8',
          },
        ],
      },
    ],
  })

  const q = {
    items: {
      $aggregate: {
        $function: { $name: 'count' },
        $traverse: 'descendants',
        $filter: [
          {
            $field: 'subthings',
            $operator: 'has',
            $value: ['th1', 'th5'],
          },
        ],
      },
    },
  }

  for (let i = 0; i < 300; i++) {
    deepEqualIgnoreOrder(t, await client.get(q), { items: 2 })
    await wait(1)
  }

  //let indState = await getIndexingState(client)
  //console.log(indState);

  // Add a new node with matching subthings
  await client.set({
    $id: 'thc',
    name: 'Main thing C',
    subthings: { $add: ['th1'] }
  })

  for (let i = 0; i < 300; i++) {
    deepEqualIgnoreOrder(t, await client.get(q), { items: 3 })
    await wait(1)
  }

  //indState = await getIndexingState(client)
  //console.log(indState);
  //t.deepEqual(indState[`${mainThing}.O.eyJzdWJ0aGluZ3MifQ==.InRoIiBl`].card, 10)

  // Remove subthings
  await client.set({
    $id: 'thc',
    name: 'Main thing C',
    subthings: []
  })

  for (let i = 0; i < 300; i++) {
    deepEqualIgnoreOrder(t, await client.get(q), { items: 2 })
    await wait(1)
  }

  //indState = await getIndexingState(client)
  //console.log(indState);

  //console.dir(await client.command('index.debug', []), { depth: 100 })
})
