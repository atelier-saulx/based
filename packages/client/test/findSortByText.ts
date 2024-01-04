import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import './assertions'
import getPort from 'get-port'
import { deepEqualIgnoreOrder } from './assertions'

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
          value: { type: 'number' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          title: { type: 'text' },
          fun: { type: 'set', items: { type: 'string' } },
          related: { type: 'references' },
          value: { type: 'number' },
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

test('find - sort by text', async (t) => {
  const { client } = t.context
  // simple nested - single query
  const globMatches: any = []
  const leaguesSet: any = []
  for (let i = 0; i < 10; i++) {
    const matches: any = []
    for (let j = 0; j < 10; j++) {
      const match = {
        $id: await client.id({ type: 'match' }),
        $language: 'en',
        type: 'match',
        name: 'match' + j,
        title: 'match' + j,
        value: Number(i + '.' + j),
        related: globMatches.map((v: any) => v.$id),
      }
      matches.push(match)
      globMatches.push(match)
    }
    const matchesIds = await Promise.all(matches.map((m: any) => client.set(m)))
    leaguesSet.push({
      type: 'league',
      name: 'league' + i,
      value: i,
      children: matchesIds,
    })
  }
  await Promise.all(leaguesSet.map((v: any) => client.set(v)))

  const result = await client.get({
    $id: 'root',
    $language: 'en',
    children: {
      id: true,
      title: true,
      $list: {
        $sort: {
          $field: 'name',
          $order: 'asc',
        },
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'match',
          },
        },
      },
    },
  })

  for (let i = 0; i < result.children.length; i++) {
    const idx = Math.floor(i / 10)
    deepEqualIgnoreOrder(t, result.children[i].title, `match${idx}`)
  }

  const result2 = await client.get({
    $id: 'root',
    $language: 'en',
    children: {
      id: true,
      title: true,
      $list: {
        $sort: {
          $field: 'title',
          $order: 'asc',
        },
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'match',
          },
        },
      },
    },
  })

  for (let i = 0; i < result2.children.length; i++) {
    const idx = Math.floor(i / 10)
    deepEqualIgnoreOrder(t, result2.children[i].title, `match${idx}`)
  }

  const result3 = await client.get({
    $id: 'root',
    $language: 'en',
    children: {
      id: true,
      title: true,
      $list: {
        $sort: {
          $field: 'title',
        },
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'match',
          },
        },
      },
    },
  })
  t.truthy(result3)
})

test('sort by text with missing field values', async (t) => {
  const { client } = t.context
  await client.set({
    type: 'match',
    title: { en: 'abc' },
  })
  await client.set({
    type: 'match',
    title: { en: 'mazzzz' },
  })
  await client.set({
    type: 'match',
    name: 'a name',
  })
  await client.set({
    type: 'match',
    title: { en: '4' },
  })
  await client.set({
    type: 'match',
    name: 'another name',
  })

  t.deepEqual(
    await client.get({
      $language: 'en',
      children: {
        title: true,
        $list: {
          $sort: {
            $field: 'title',
            $order: 'asc',
          },
        },
      },
    }),
    {
      children: [{ title: '4' }, { title: 'abc' }, { title: 'mazzzz' }, {}, {}],
    }
  )

  t.deepEqual(
    await client.get({
      $language: 'en',
      children: {
        title: true,
        $list: {
          $sort: {
            $field: 'title',
            $order: 'asc',
          },
          $offset: 1,
          $limit: 1,
        },
      },
    }),
    { children: [{ title: 'abc' }] }
  )
})
