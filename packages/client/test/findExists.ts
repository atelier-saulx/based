import test from 'ava'
import { BasedDbClient } from '../src'
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
    languages: ['en'],
    types: {
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
          thing: { type: 'string' },
        },
      },
      special: {
        prefix: 'sp',
        fields: {
          name: { type: 'string' },
          thing: { type: 'string' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          description: { type: 'text' },
          value: {
            type: 'number',
          },
          status: { type: 'number' },
        },
      },
    },
  })
})

test.after(async (_t) => {
  await srv.destroy()
  client.destroy()
})

// TODO: $operator 'exists' not working
test.serial.skip('find - numeric exists field', async (t) => {
  // simple nested - single query
  await client.set({
    type: 'match',
    name: 'match 1',
    value: 1,
  })

  await client.set({
    type: 'match',
    name: 'match 2',
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        nonsense: { $default: 'yes' },
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    }),
    { id: 'root', items: [{ name: 'match 1', nonsense: 'yes' }] }
  )
})

// TODO: $operator 'exists' not working
test.serial.skip('find - string field only exists', async (t) => {
  // simple nested - single query
  await client.set({
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    type: 'league',
    name: 'league 2',
    thing: 'yes some value here',
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'league',
              },
              {
                $field: 'thing',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    }),
    { id: 'root', items: [{ name: 'league 2' }] }
  )
})

// TODO: $operator 'notExists' not working
test.serial.skip('find - numeric not exists field', async (t) => {
  // simple nested - single query
  await client.set({
    type: 'match',
    name: 'match 1',
    value: 1,
  })

  await client.set({
    type: 'match',
    name: 'match 2',
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'root',
      id: true,
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'value',
                $operator: 'notExists',
              },
            ],
          },
        },
      },
    }),
    { id: 'root', items: [{ name: 'match 2' }] }
  )
})

// TODO: $operator 'notExists' not working
test.serial.skip('find - string field only not exists indexed', async (t) => {
  // simple nested - single query
  await client.set({
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    type: 'league',
    name: 'league 2',
    thing: 'yes some value here',
  })

  const m = await client.get({
    $includeMeta: true,
    $id: 'root',
    id: true,
    items: {
      name: true,
      $list: {
        $find: {
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'league',
            },
            {
              $field: 'thing',
              $operator: 'notExists',
            },
          ],
        },
      },
    },
  })

  delete m.$meta

  t.deepEqualIgnoreOrder(m, { id: 'root', items: [{ name: 'league 1' }] })
})

// TODO: $operator 'exists' not working
test.serial.skip('find - text exists field', async (t) => {
  // simple nested - single query
  await client.set({
    $language: 'en',
    $id: 'ma1',
    type: 'match',
    description: 'match 1',
    value: 1,
  })

  await client.set({
    $language: 'en',
    $id: 'ma2',
    type: 'match',
    name: 'match 2',
    value: 1,
  })

  await client.set({
    $language: 'en',
    $id: 'le1',
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    $language: 'en',
    $id: 'sp1',
    type: 'special',
    name: 'special 1',
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'root',
      id: true,
      items: {
        description: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'description',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    }),
    { id: 'root', items: [{ description: { en: 'match 1' } }] }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $language: 'en',
      $id: 'root',
      id: true,
      items: {
        description: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'description',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    }),
    { id: 'root', items: [{ description: 'match 1' }] }
  )

  let err = await t.throwsAsync(
    client.get({
      $language: 'en',
      $id: 'root',
      id: true,
      items: {
        description: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type$',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: 'description',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    })
  )
  t.assert(err?.stack?.includes('contains unsupported characters'))

  err = await t.throwsAsync(
    client.get({
      $language: 'en',
      $id: 'root',
      id: true,
      items: {
        description: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'match',
              },
              {
                $field: '_description',
                $operator: 'exists',
              },
            ],
          },
        },
      },
    })
  )
  t.assert(err?.stack?.includes('contains unsupported characters'))
})
