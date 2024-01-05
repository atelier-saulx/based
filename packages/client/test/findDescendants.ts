import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
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
        },
      },
      club: {
        prefix: 'cl',
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
      sport: {
        prefix: 'sp',
        fields: {
          rando: { type: 'string' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          flupriflu: { type: 'string' },
          date: { type: 'number' },
          // need to warn if you change this!!!
          value: { type: 'number' },
          status: { type: 'number' },
        },
      },
      video: {
        prefix: 'vi',
        fields: {
          name: { type: 'string' },
          title: { type: 'text' },
          date: { type: 'number' },
          // making it different here should tell you something or at least take it over
          value: { type: 'number' },
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

test('find - descendants 1', async (t) => {
  const { client } = t.context

  const team1 = await t.context.client.set({ type: 'team', name: 'team1' })

  const amount = 50000
  const vids = 100
  const genMatches = (s = 0) => {
    const ch: any = []
    for (let i = s; i < s + amount; i++) {
      if (i < 1000) {
        ch.push({
          type: 'match',
          flupriflu: 'true',
          name: 'match' + i,
          status: i === 0 ? 2 : i > 1000 ? 100 : 300,
          parents: { $add: team1 },
        })
      } else {
        ch.push({
          type: 'match',
          name: 'match' + i,
          status: 100,
        })
      }
    }
    return ch
  }

  const genVideos = () => {
    const ch: any = []
    for (let i = 0; i < vids; i++) {
      ch.push({
        type: 'video',
        name: 'video',
        title: { en: 'flap' },
        date: Date.now() + i + (i > 5 ? 1000000 : -100000),
        value: i,
      })
    }
    return ch
  }

  const d = Date.now()
  const ids = await Promise.all([
    t.context.client.set({
      type: 'club',
      name: 'club 1',
      children: [
        {
          $id: team1,
          name: 'team 1',
          children: {
            $add: genVideos(),
          },
        },
      ],
    }),
    t.context.client.set({
      type: 'league',
      name: 'league 1',
      // @ts-ignore
      children: genMatches(),
    }),
    t.context.client.set({
      type: 'league',
      name: 'league 2',
      // @ts-ignore
      children: genMatches(amount),
    }),
  ])

  console.info(
    `Set ${Math.floor((amount * 2 + vids) / 100) / 10}k nested`,
    Date.now() - d,
    'ms'
  )

  await wait(600)
  t.true(ids[0].slice(0, 2) === 'cl' && ids[1].slice(0, 2) === 'le')

  try {
    await wait(2e3)

    // // extra option in find is index or auto from fields
    const d = Date.now()
    await client.get({
      items: {
        name: true,
        value: true,
        status: true,
        date: true,
        id: true,
        type: true,
        $list: {
          $sort: { $field: 'status', $order: 'desc' },
          $limit: 1000,
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $operator: '=',
                $field: 'type',
                $value: 'match',
                $and: {
                  $operator: '=',
                  $field: 'status',
                  $value: [300, 2],
                },
                $or: {
                  $operator: '=',
                  $field: 'name',
                  $value: 'league 1',
                  $or: {
                    $operator: '>',
                    $field: 'value',
                    $value: 4,
                    $and: {
                      $operator: '>',
                      $field: 'value',
                      $value: 6,
                      $and: {
                        $operator: '<',
                        $field: 'value',
                        $value: 8,
                        $and: {
                          $operator: '>',
                          $field: 'date',
                          $value: 'now',
                        },
                      },
                    },
                  },
                },
              },
              {
                $operator: '!=',
                $field: 'name',
                $value: ['match1', 'match2', 'match3'],
              },
            ],
          },
        },
      },
    })

    console.info('Executing query (1100 resuls)', Date.now() - d, 'ms')

    // t.is(matches.length, 997, 'query result matches')
    // t.is(videos.length, 3, 'query result videos')
    // t.is(league.length, 1, 'query result league')

    const team = (
      await client.get({
        items: {
          id: true,
          $list: {
            $find: {
              $traverse: 'descendants',
              $filter: {
                $field: 'type',
                $operator: '=',
                $value: 'team',
              },
            },
          },
        },
      })
    ).items

    t.true(/te/.test(team[0].id), 'got id from team')

    const { items: teamMatches } = await client.get({
      $id: team[0].id,
      items: {
        id: true,
        $list: {
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

    t.is(teamMatches.length, 1000)

    const { items: teamMatchesRange } = await client.get({
      $id: team[0].id,
      items: {
        id: true,
        $list: {
          $limit: 5,
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

    t.is(teamMatchesRange.length, 5)

    const { items: videosSorted } = await client.get({
      items: {
        value: true,
        $list: {
          $sort: { $field: 'value', $order: 'desc' },
          $limit: 5,
          $find: {
            $traverse: 'descendants',
            $filter: {
              $field: 'type',
              $operator: '=',
              $value: 'video',
            },
          },
        },
      },
    })

    t.deepEqual(
      videosSorted.map((v: any) => v.value),
      [99, 98, 97, 96, 95]
    )

    const { items: nextVideosSorted } = await client.get({
      items: {
        value: true,
        $list: {
          $sort: { $field: 'value', $order: 'desc' },
          $limit: 5,
          $offset: 5,
          $find: {
            $traverse: 'descendants',
            $filter: {
              $field: 'type',
              $operator: '=',
              $value: 'video',
            },
          },
        },
      },
    })

    console.log(
      'hello nice',
      nextVideosSorted.map((v: any) => v.value)
    )

    t.deepEqual(
      nextVideosSorted.map((v: any) => v.value),
      [94, 93, 92, 91, 90]
    )

    const { items: empty } = await client.get({
      items: {
        name: true,
        $list: {
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $operator: '=',
                $field: 'name',
                $value: 'gurk',
              },
              {
                $operator: '=',
                $field: 'name',
                $value: ['flap', 'gurk'],
              },
            ],
          },
        },
      },
    })

    await wait(2000)

    t.deepEqual(empty, [], 'does not throw for TAG fields')

    await wait(2000)

    const { items: videosText } = await client.get({
      $language: 'en',
      items: {
        value: true,
        $list: {
          $sort: { $field: 'value', $order: 'desc' },
          $limit: 5,
          $find: {
            $traverse: 'descendants',
            $filter: {
              $field: 'title',
              $operator: '=',
              $value: 'flap',
            },
          },
        },
      },
    })

    console.info('videos text make it nice nice', videosText)

    t.deepEqual(videosText, [
      { value: 99 },
      { value: 98 },
      { value: 97 },
      { value: 96 },
      { value: 95 },
    ])
  } catch (err) {
    console.error(err)
    t.fail()
  }
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

// from w_youri.ts
test('$inherit in a list', async (t) => {
  const { client } = t.context

  await client.set({
    type: 'sport',
    rando: 'rando!',
    children: [
      {
        type: 'match',
      },
    ],
  })

  const a = await client.get({
    $id: 'root',
    children: {
      rando: {
        $inherit: { $type: 'sport' },
      },
      $list: {
        $limit: 100,
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

  // const b = await client.get({
  //   $id: 'root',
  //   children: {
  //     rando: {
  //       $inherit: { $type: 'sport' }
  //     },
  //     $list: {
  //       $limit: 100,
  //       $find: {
  //         $traverse: 'descendants',
  //         $filter: {
  //           $field: 'type',
  //           $operator: '=',
  //           $value: 'match'
  //         }
  //       }
  //     }
  //   }
  // })

  t.log(a)
  t.deepEqual(a, { children: [{ rando: 'rando!' }] })
  // t.deepEqual(a, b)
})
