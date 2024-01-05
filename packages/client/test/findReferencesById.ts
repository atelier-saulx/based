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
      const match = {
        $id: await client.id({ type: 'match' }),
        type: 'match',
        name: 'match' + j,
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
      value: true,
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
    { value: 4, name: 'match0' },
    { value: 3.9, name: 'match9' },
    { value: 3.8, name: 'match8' },
    { value: 3.7, name: 'match7' },
    { value: 3.6, name: 'match6' },
    { value: 3.5, name: 'match5' },
    { value: 3.4, name: 'match4' },
    { value: 3.3, name: 'match3' },
    { value: 3.2, name: 'match2' },
    { value: 3.1, name: 'match1' },
    { value: 3, name: 'match0' },
    { value: 2.9, name: 'match9' },
    { value: 2.8, name: 'match8' },
    { value: 2.7, name: 'match7' },
    { value: 2.6, name: 'match6' },
    { value: 2.5, name: 'match5' },
    { value: 2.4, name: 'match4' },
    { value: 2.3, name: 'match3' },
    { value: 2.2, name: 'match2' },
    { value: 2.1, name: 'match1' },
    { value: 2, name: 'match0' },
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

  deepEqualIgnoreOrder(
    t,
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
      value: true,
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

  deepEqualIgnoreOrder(
    t,
    relatedMatchesLeaguesNoTraverse,
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
})
