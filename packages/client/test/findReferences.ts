import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
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
    language: 'en',
    root: {
      prefix: 'ro',
      fields: {},
    },
    types: {
      thing: {
        prefix: 'th',
        fields: {
          name: { type: 'string' },
          subthings: { type: 'references' },
        },
      },
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

test('find - references', async (t) => {
  const { client } = t.context
  // simple nested - single query
  const globMatches: any = []
  const leaguesSet: any = []
  for (let i = 0; i < 10; i++) {
    const matches: any = []
    for (let j = 0; j < 10; j++) {
      const match: any = {
        $id: await client.id({ type: 'match' }),
        type: 'match',
        name: 'match' + j,
        value: Number(i + '.' + j),
        related: globMatches.map((v: any) => v.$id),
      }
      matches.push(match)
      globMatches.push(match)
    }
    leaguesSet.push({
      type: 'league',
      name: 'league' + i,
      value: i,
      children: matches,
    })
  }
  await Promise.all(leaguesSet.map((v: any) => client.set(v)))

  const { items: leagues } = await client.get({
    items: {
      id: true,
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'desc' },
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'league',
          },
        },
      },
    },
  })

  const league = leagues[0].id

  const { items: matches } = await client.get({
    $id: league,
    items: {
      id: true,
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'desc' },
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
              $operator: '..',
              $value: [5, 10],
            },
          ],
        },
      },
    },
  })

  const { items: relatedMatches } = await client.get({
    $id: matches[0].id,
    items: {
      name: true,
      special: { num: { $field: 'value' } },
      $list: {
        $sort: { $field: 'value', $order: 'desc' },
        $find: {
          $traverse: 'related',
          $filter: [
            {
              $field: 'value',
              $operator: '<',
              $value: 4,
            },
            {
              $field: 'value',
              $operator: '<',
              $value: 'now',
            },
            {
              $field: 'value',
              $operator: '>',
              $value: 2,
            },
          ],
        },
      },
    },
  })

  t.deepEqual(relatedMatches, [
    { special: { num: 4 }, name: 'match0' },
    { special: { num: 3.9 }, name: 'match9' },
    { special: { num: 3.8 }, name: 'match8' },
    { special: { num: 3.7 }, name: 'match7' },
    { special: { num: 3.6 }, name: 'match6' },
    { special: { num: 3.5 }, name: 'match5' },
    { special: { num: 3.4 }, name: 'match4' },
    { special: { num: 3.3 }, name: 'match3' },
    { special: { num: 3.2 }, name: 'match2' },
    { special: { num: 3.1 }, name: 'match1' },
    { special: { num: 3 }, name: 'match0' },
    { special: { num: 2.9 }, name: 'match9' },
    { special: { num: 2.8 }, name: 'match8' },
    { special: { num: 2.7 }, name: 'match7' },
    { special: { num: 2.6 }, name: 'match6' },
    { special: { num: 2.5 }, name: 'match5' },
    { special: { num: 2.4 }, name: 'match4' },
    { special: { num: 2.3 }, name: 'match3' },
    { special: { num: 2.2 }, name: 'match2' },
    { special: { num: 2.1 }, name: 'match1' },
    { special: { num: 2 }, name: 'match0' },
  ])

  const { items: relatedMatchesLeagues } = await client.get({
    $id: matches[0].id,
    items: {
      name: true,
      value: true,
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $find: {
          $traverse: 'related',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'match',
          },

          $find: {
            $traverse: 'ancestors',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'league',
              },
              {
                $field: 'value',
                $operator: '<',
                $value: 10,
              },
            ],
          },
        },
      },
    },
  })

  console.dir({ relatedMatchesLeagues }, { depth: 6 })

  t.deepEqual(
    relatedMatchesLeagues,
    [
      { value: 0, name: 'league0' },
      { value: 1, name: 'league1' },
      { value: 2, name: 'league2' },
      { value: 3, name: 'league3' },
      { value: 4, name: 'league4' },
      { value: 5, name: 'league5' },
      { value: 6, name: 'league6' },
      { value: 7, name: 'league7' },
      { value: 8, name: 'league8' },
      { value: 9, name: 'league9' },
    ],
    'Nested query'
  )

  await wait(1000)

  const { related: relatedMatchesLeaguesNoTraverse } = await client.get({
    $id: matches[0].id,
    related: {
      name: true,
      special: { num: { $field: 'value' } },
      // value: true,
      $list: {
        $sort: { $field: 'value', $order: 'asc' },
        $find: {
          $find: {
            $traverse: 'ancestors',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'league',
              },
              {
                $field: 'value',
                $operator: '<',
                $value: 10,
              },
            ],
          },
        },
      },
    },
  })

  t.deepEqual(
    relatedMatchesLeaguesNoTraverse,
    [
      // { value: 0, special: { num: 0 }, name: 'league0' },
      // { value: 1, special: { num: 1 }, name: 'league1' },
      // { value: 2, special: { num: 2 }, name: 'league2' },
      // { value: 3, special: { num: 3 }, name: 'league3' },
      // { value: 4, special: { num: 4 }, name: 'league4' },
      // { value: 5, special: { num: 5 }, name: 'league5' },
      // { value: 6, special: { num: 6 }, name: 'league6' },
      // { value: 7, special: { num: 7 }, name: 'league7' },
      // { value: 8, special: { num: 8 }, name: 'league8' },
      // { value: 9, special: { num: 9 }, name: 'league9' },
      { special: { num: 0 }, name: 'league0' },
      { special: { num: 1 }, name: 'league1' },
      { special: { num: 2 }, name: 'league2' },
      { special: { num: 3 }, name: 'league3' },
      { special: { num: 4 }, name: 'league4' },
      { special: { num: 5 }, name: 'league5' },
      { special: { num: 6 }, name: 'league6' },
      { special: { num: 7 }, name: 'league7' },
      { special: { num: 8 }, name: 'league8' },
      { special: { num: 9 }, name: 'league9' },
    ],
    'Nested query'
  )
})

test('find references recursive', async (t) => {
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
})
