import { wait } from '@saulx/utils'
import { basicTest } from '../assertions/index.js'
import { subscribe } from '@based/db-subs'

const test = basicTest({
  language: 'en',
  root: {
    fields: { yesh: { type: 'string' }, no: { type: 'string' } },
  },
  types: {
    league: {
      prefix: 'le',
      fields: {
        name: { type: 'string' },
      },
    },
    team: {
      prefix: 'te',
      fields: {
        name: { type: 'string' },
      },
    },
    match: {
      prefix: 'ma',
      fields: {
        name: { type: 'string' },
        value: { type: 'number' },
        status: { type: 'number' },
        date: { type: 'number' },
      },
    },
  },
})

// TODO: sub events should de de-duplicated better (on sub manager side)
test.serial.skip('subscription find', async (t) => {
  const client = t.context.client

  const matches: any[] = []
  const teams: any[] = []

  for (let i = 0; i < 100; i++) {
    teams.push({
      $id: await client.id({ type: 'team' }),
      name: 'team ' + i,
      type: 'team',
    })
  }

  for (let i = 0; i < 10; i++) {
    matches.push({
      $id: await client.id({ type: 'match' }),
      name: 'match ' + i,
      type: 'match',
      value: i,
      parents: {
        $add: [
          teams[~~(Math.random() * teams.length)].$id,
          teams[~~(Math.random() * teams.length)].$id,
        ],
      },
      status: i < 5 ? 100 : 300,
    })
  }

  await Promise.all(teams.map((t) => client.set(t)))

  await client.set({
    type: 'league',
    name: 'league 1',
    children: matches,
  })

  await wait(200)

  let cnt = 0
  subscribe(
    client,
    {
      items: {
        name: true,
        id: true,
        $list: {
          $find: {
            $traverse: 'descendants',
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
    },
    (_d: any) => {
      cnt++
    }
  )

  await wait(1000)
  t.is(cnt, 1)

  await client.set({
    $id: matches[0].$id,
    value: 8,
  })

  await wait(1000)
  t.is(cnt, 2)

  await client.set({
    $id: matches[1].$id,
    value: 8,
  })
  await wait(1000)
  t.is(cnt, 3)

  let cnt2 = 0
  subscribe(
    client,
    {
      $includeMeta: true,
      items: {
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
        name: true,
        id: true,
        teams: {
          id: true,
          name: true,
          $list: {
            $find: {
              $traverse: 'ancestors',
              $filter: [
                {
                  $field: 'type',
                  $operator: '=',
                  $value: 'team',
                },
              ],
            },
          },
        },
      },
    },
    (_d: any) => {
      cnt2++
    }
  )

  await wait(1000)
  t.is(cnt2, 1)

  let matchTeam: any
  for (let i = 0; i < 10; i++) {
    matches.forEach((m) => {
      m.value = 8
      m.parents = {
        $add: [
          (matchTeam = teams[~~(Math.random() * teams.length)].$id),
          teams[~~(Math.random() * teams.length)].$id,
        ],
      }
    })
  }

  await Promise.all(matches.map((t) => client.set(t)))

  await wait(1000)
  t.is(cnt2, 2)

  let cnt3 = 0
  subscribe(
    client,
    {
      $id: matchTeam,
      $includeMeta: true,
      children: {
        name: true,
        $list: {
          $find: {
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
    },
    (_d: any) => {
      cnt3++
    }
  )

  await wait(1000)
  // how to handle large responses ???

  // remove unpack

  // for now 1k
  const amount = 10 // 10k wrong 5k fine

  const x: any[] = []
  for (let i = 0; i < amount; i++) {
    x.push(
      client.set({
        type: 'match',
        value: i,
        parents: { $add: matchTeam },
      })
    )
  }

  const ids = await Promise.all(x)

  await wait(2000)

  client.set({
    $id: ids[6],
    name: 'FLURRRRP',
  })
  await wait(1000)

  t.is(cnt3, 3, 'check for count')
  await wait(2000)
})
