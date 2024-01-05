import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions'
import getPort from 'get-port'

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
    language: 'en',
    types: {
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
          thing: { type: 'string' },
          matches: { type: 'references' },
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

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('find - by type', async (t) => {
  const { client } = t.context
  // simple nested - single query
  await client.set({
    $id: 'le1',
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    $id: 'ma1',
    parents: ['le1'],
    type: 'match',
    name: 'match 1',
    value: 1,
  })

  await client.set({
    $id: 'ma2',
    parents: ['ma1'],
    type: 'match',
    name: 'match 2',
    value: 2,
  })

  await client.set({
    $id: 'ma3',
    parents: ['ma1'],
    type: 'match',
    name: 'match 3',
  })

  await client.set({
    $id: 'ma4',
    parents: ['le1'],
    type: 'match',
    name: 'match 4',
    value: 12312,
  })

  await client.set({
    $id: 'le1',
    matches: ['ma1', 'ma2', 'ma3'],
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      items: {
        name: true,
        nonsense: { $default: 'yes' },
        $list: {
          $find: {
            $recursive: true,
            $traverse: {
              root: 'children',
              league: 'children',
              $any: false,
            },
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
    {
      items: [
        {
          name: 'match 1',
          nonsense: 'yes',
        },
        {
          name: 'match 4',
          nonsense: 'yes',
        },
        // { name: 'match 2', nonsense: 'yes' },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      items: {
        name: true,
        nonsense: { $default: 'yes' },
        $list: {
          $find: {
            $recursive: true,
            $traverse: {
              root: 'children',
              league: { $first: ['matches', 'children'] },
              $any: false,
            },
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
    {
      items: [
        {
          name: 'match 1',
          nonsense: 'yes',
        },
        {
          name: 'match 2',
          nonsense: 'yes',
        },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      items: {
        name: true,
        nonsense: { $default: 'yes' },
        $list: {
          $find: {
            $recursive: true,
            $traverse: {
              root: 'children',
              league: { $all: ['matches', 'children'] },
              $any: false,
            },
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
    {
      items: [
        {
          name: 'match 1',
          nonsense: 'yes',
        },
        {
          name: 'match 2',
          nonsense: 'yes',
        },
        {
          name: 'match 4',
          nonsense: 'yes',
        },
      ],
    }
  )
})

test('find - by IS NOT type', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'le1',
    type: 'league',
    name: 'league 1',
  })

  await client.set({
    $id: 'ma1',
    parents: ['le1'],
    type: 'match',
    name: 'match 1',
    value: 1,
  })

  const res = await client.get({
    matches: {
      id: true,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '!=',
            $value: 'league',
          },
        },
      },
    },
  })
  t.log('0-0000', res)
  t.is(res.matches.length, 1)

  const resWithLanguage = await client.get({
    $language: 'en',
    matches: {
      id: true,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '!=',
            $value: 'league',
          },
        },
      },
    },
  })
  t.is(resWithLanguage.matches.length, 1)

  await client.set({
    $id: 'ma2',
    parents: ['le1'],
    type: 'match',
    name: 'match 2',
    description: { en: 'some' },
    value: 1,
  })

  const resWithLanguage1 = await client.get({
    $language: 'en',
    matches: {
      id: true,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'description',
            $operator: '!=',
            $value: 'some',
          },
        },
      },
    },
  })
  t.is(resWithLanguage1.matches.length, 2)
})
