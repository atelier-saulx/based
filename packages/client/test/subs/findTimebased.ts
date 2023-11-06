import anyTest, { ExecutionContext, TestInterface } from 'ava'
import { BasedServer } from '@based/server'
import { BasedClient } from '@based/client'
import {
  SubsClient,
  createServerSettings,
  createPollerSettings,
} from '@based/db-subs'
import { BasedDbClient } from '@based/db-client'
import { SelvaServer, startOrigin } from '@based/db-server'
import getPort from 'get-port'
import { deepCopy, wait } from '@saulx/utils'
import '../assertions'

type TestCtx = {
  srv: SelvaServer
  subClient: SubsClient
  dbClient: BasedDbClient
  pollerClient: BasedClient
  port: number
}

const test = anyTest as TestInterface<TestCtx>

const startPoller = async (t: ExecutionContext<TestCtx>) => {
  const port = await getPort()
  t.context.port = port
  const server = new BasedServer({
    ...createPollerSettings(),
    port,
  })

  await server.start()

  const client = new BasedClient({
    url: `ws://localhost:${port}`,
  })

  t.teardown(async () => {
    await server.destroy()
    await client.destroy()
  })

  t.context.pollerClient = client
}

const startDb = async (t: ExecutionContext<TestCtx>) => {
  const port = await getPort()
  t.context.srv = await startOrigin({
    name: 'default',
    port,
  })
  t.context.dbClient = new BasedDbClient()
  t.context.dbClient.connect({ port, host: '127.0.0.1' })

  t.teardown(async () => {
    await t.context.srv.destroy()
    t.context.dbClient.destroy()
  })
}

const startServer = async (t: ExecutionContext<TestCtx>) => {
  const port = await getPort()
  const server = new BasedServer({
    ...createServerSettings(
      t.context.pollerClient,
      () => {
        return t.context.dbClient
      },
      `ws://localhost:${port}`
    ),
    port,
  })
  await server.start()
  const client = new SubsClient(t.context.pollerClient)
  t.context.subClient = client

  t.teardown(async () => {
    await server.destroy()
    await client.destroy()
  })
}

const start = async (t: ExecutionContext<TestCtx>) => {
  await startPoller(t)
  await startDb(t)
  await startServer(t)

  await updateSchema(t)
}

const observe = async (
  t: ExecutionContext<TestCtx>,
  q: any,
  cb: (d: any) => void
) => {
  const { subClient } = t.context
  const id = subClient.subscribe('db', q, cb)
  return id
}

async function updateSchema(t: ExecutionContext<TestCtx>) {
  await t.context.dbClient.updateSchema({
    language: 'en',
    translations: ['de', 'fr', 'it', 'nl'],
    root: {
      fields: {
        title: { type: 'text' },
      },
    },
    types: {
      folder: {
        prefix: 'fo',
        fields: {
          name: { type: 'string' },
          title: { type: 'text' },
        },
      },
      league: {
        prefix: 'le',
        fields: {
          value: { type: 'number' },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          title: { type: 'text' },
          published: { type: 'boolean' },
        },
      },
      video: {
        prefix: 'vi',
        fields: {
          title: { type: 'text' },
          published: { type: 'boolean' },
        },
      },
      sport: {
        prefix: 'sp',
        fields: {
          title: { type: 'text' },
          published: { type: 'boolean' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          title: { type: 'text' },
          published: { type: 'boolean' },
          homeTeam: { type: 'reference' },
          awayTeam: { type: 'reference' },
          startTime: {
            type: 'timestamp',
          },
          endTime: {
            type: 'timestamp',
          },
          date: {
            type: 'timestamp',
          },
          fun: { type: 'set', items: { type: 'string' } },
          related: { type: 'references' },
          value: { type: 'number' },
          status: { type: 'number' },
        },
      },
    },
  })
}

test.serial.skip('subs layout', async (t) => {
  await start(t)
  const client = t.context.dbClient

  let now = Date.now()
  let viIdx = 0

  await client.set({
    $id: 'root',
    title: {
      en: 'root',
    },
  })

  await client.set({
    $id: 'te1',
    published: true,
    title: {
      en: 'team one',
      de: 'team ein',
    },
  })

  await client.set({
    $id: 'te2',
    published: true,
    title: {
      en: 'team two',
      de: 'team zwei',
    },
  })

  await client.set({
    $id: 'sp1',
    title: { en: 'sport one', de: 'sport ein' },
    published: true,
    children: ['te1', 'te2'],
  })

  const highlights = await client.set({
    $id: 'fo1',
    title: {
      en: 'Highlights',
    },
    name: 'Highlights',
    parents: ['sp1'],
  })

  observe(
    t,
    {
      $language: 'en',
      matches: {
        id: true,
        title: true,
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
                $field: 'published',
                $operator: '=',
                $value: true,
              },
            ],
          },
        },
      },
    },
    (r) => console.info(r)
  )

  observe(
    t,
    {
      $language: 'de',
      matches: {
        id: true,
        title: true,
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
                $field: 'published',
                $operator: '=',
                $value: true,
              },
            ],
          },
        },
      },
    },
    (r) => console.info(r)
  )

  const past: any[] = []
  const pastPublishedIds: any[] = []
  for (let i = 0; i < 1000; i++) {
    const team = i % 2 === 0 ? 'te2' : 'te1'
    let published = true
    if (i % 3 === 0) {
      published = false
    }

    past.push(
      client.set({
        type: 'match',
        $id: 'map' + i,
        published,
        homeTeam: 'te1',
        awayTeam: 'te2',
        title: {
          en: 'past match ' + i,
          de: 'vorbei match ' + i,
          nl: 'verleden match ' + 1,
        },
        name: 'past match',
        date: now - 1000 * 60 - i - 1,
        startTime: now - 1000 * 60 - i - 1,
        endTime: now - (1000 * 60 - i - 1),
        parents: [team, highlights],
        children: [{ $id: 'vi' + viIdx++, published: true }],
      })
    )

    if (published) {
      pastPublishedIds.push({ id: 'map' + i })
    }
  }

  await Promise.all(past)

  const upcoming: any[] = []
  const upcomingPublishedIds: any[] = []
  for (let i = 0; i < 1000; i++) {
    const team = i % 2 === 0 ? 'te2' : 'te1'
    let published = true
    if (i % 3 === 0) {
      published = false
    }

    upcoming.push(
      client.set({
        type: 'match',
        $id: 'maug' + i,
        published,
        name: 'past match',
        homeTeam: 'te1',
        awayTeam: 'te2',
        title: {
          en: 'gen upcoming match ' + i,
          de: 'gen kommend match ' + i,
          nl: 'gen aanstaande match ' + i,
        },
        date: now + 1000 * 60 + i,
        startTime: now + 1000 * 60 + i,
        endTime: now + (1000 * 60 + i + 1),
        parents: [team, highlights],
        children: [{ $id: 'vi' + viIdx++, published: true }],
      })
    )

    if (published) {
      upcomingPublishedIds.push({ id: 'maug' + i })
    }
  }

  await Promise.all(upcomingPublishedIds)

  await wait(4000)
  now = Date.now()

  await Promise.all([
    client.set({
      type: 'match',
      $id: 'mau1',
      published: true,
      homeTeam: 'te1',
      awayTeam: 'te2',
      title: {
        en: 'upcoming match 1',
        de: 'kommend match 1',
        nl: 'aanstaande match 1',
      },
      name: 'upcoming match',
      date: now + 2000,
      parents: ['te1', highlights],
      startTime: now + 2000, // 2 sec from now
      endTime: now + 5000, // 5 sec from now
      children: [
        { $id: 'vi' + viIdx++, published: true },
        { $id: 'vi' + viIdx++, published: true },
      ],
    }),
    client.set({
      type: 'match',
      $id: 'mau2',
      homeTeam: 'te1',
      awayTeam: 'te2',
      title: {
        en: 'upcoming match 2',
        de: 'kommend match 2',
        nl: 'aanstaande match 2',
      },
      published: true,
      parents: ['te2'],
      name: 'upcoming match',
      date: now + 5000,
      startTime: now + 5000, // 5 sec from now
      endTime: now + 7000, // 7 sec from now
      children: [
        { $id: 'vi' + viIdx++, published: true },
        { $id: 'vi' + viIdx++, published: true },
      ],
    }),
  ])

  let result: any
  observe(
    t,
    {
      past: {
        id: true,
        $list: {
          $sort: {
            $field: 'date',
            $order: 'desc',
          },
          $limit: 10,
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $operator: '=',
                $value: 'match',
                $field: 'type',
              },
              {
                $operator: '=',
                $value: true,
                $field: 'published',
              },
              {
                $value: 'now',
                $field: 'endTime',
                $operator: '<',
              },
            ],
          },
        },
      },
      live: {
        id: true,
        $list: {
          $sort: {
            $field: 'date',
            $order: 'asc',
          },
          $limit: 10,
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $operator: '=',
                $value: 'match',
                $field: 'type',
              },
              {
                $operator: '=',
                $value: true,
                $field: 'published',
              },
              {
                $value: 'now',
                $field: 'startTime',
                $operator: '<',
              },
              {
                $value: 'now',
                $field: 'endTime',
                $operator: '>',
              },
            ],
          },
        },
      },
      upcoming: {
        id: true,
        $list: {
          $sort: {
            $field: 'date',
            $order: 'asc',
          },
          $limit: 10,
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $operator: '=',
                $value: true,
                $field: 'published',
              },
              {
                $operator: '=',
                $value: 'match',
                $field: 'type',
              },
              {
                $value: 'now',
                $field: 'startTime',
                $operator: '>',
              },
            ],
          },
        },
      },
    },
    (r) => {
      result = r
      console.info('-->', result)
    }
  )

  let otherResult1: any
  observe(
    t,
    {
      $id: 'mau1',
      $language: 'en',
      components: [
        {
          // component: {
          //   $value: 'Table',
          // },
          // title: {
          //   $value: 'Live',
          // },
          children: {
            homeTeam: {
              id: true,
              title: true,
            },
            awayTeam: {
              id: true,
              title: true,
            },
            // teams: [
            //   {
            //     id: true,
            //     $id: {
            //       $field: 'homeTeam'
            //     },
            //     title: true
            //   },
            //   {
            //     id: true,
            //     $id: {
            //       $field: 'awayTeam'
            //     },
            //     title: true
            //   }
            // ],
            type: true,
            title: true,
            id: true,
            $list: {
              $limit: 30,
              $find: {
                $filter: [
                  {
                    $field: 'type',
                    $operator: '=',
                    $value: 'sport',
                  },
                  {
                    $field: 'published',
                    $operator: '=',
                    $value: true,
                  },
                ],
                $find: {
                  $traverse: 'descendants',
                  $filter: [
                    {
                      $field: 'type',
                      $operator: '=',
                      $value: 'match',
                    },
                    {
                      $field: 'published',
                      $operator: '=',
                      $value: true,
                    },
                    {
                      $operator: '<',
                      $value: 'now',
                      $field: 'startTime',
                    },
                    {
                      $operator: '>',
                      $value: 'now',
                      $field: 'endTime',
                    },
                  ],
                },
                $traverse: 'ancestors',
              },
              $sort: {
                $order: 'desc',
                $field: 'date',
              },
            },
          },
        },
        {
          // component: {
          //   $value: 'GridLarge',
          // },
          // title: {
          //   $value: 'Team Videos',
          // },
          children: {
            type: true,
            title: true,
            $list: {
              $limit: 10,
              $find: {
                $filter: [
                  {
                    $field: 'type',
                    $operator: '=',
                    $value: 'team',
                  },
                  {
                    $field: 'published',
                    $operator: '=',
                    $value: true,
                  },
                ],
                $find: {
                  $traverse: 'descendants',
                  $filter: [
                    {
                      $field: 'type',
                      $operator: '=',
                      $value: 'video',
                    },
                    {
                      $field: 'published',
                      $operator: '=',
                      $value: true,
                    },
                  ],
                },
                $traverse: 'ancestors',
              },
              $sort: {
                $order: 'desc',
                $field: 'date',
              },
            },
            id: true,
          },
        },
      ],
    },
    (r) => {
      otherResult1 = r
      console.warn('match layout 1', r)
    }
  )

  let otherResult2: any
  observe(
    t,
    {
      $id: 'mau2',
      $language: 'en',
      components: [
        {
          // component: {
          //   $value: 'Table',
          // },
          // title: {
          //   $value: 'Live',
          // },
          children: {
            homeTeam: {
              id: true,
              title: true,
            },
            awayTeam: {
              id: true,
              title: true,
            },
            // teams: [
            //   {
            //     id: true,
            //     $id: {
            //       $field: 'homeTeam'
            //     },
            //     title: true
            //   },
            //   {
            //     id: true,
            //     $id: {
            //       $field: 'awayTeam'
            //     },
            //     title: true
            //   }
            // ],
            type: true,
            title: true,
            id: true,
            $list: {
              $limit: 30,
              $find: {
                $filter: [
                  {
                    $field: 'type',
                    $operator: '=',
                    $value: 'sport',
                  },
                  {
                    $field: 'published',
                    $operator: '=',
                    $value: true,
                  },
                ],
                $find: {
                  $traverse: 'descendants',
                  $filter: [
                    {
                      $field: 'type',
                      $operator: '=',
                      $value: 'match',
                    },
                    {
                      $field: 'published',
                      $operator: '=',
                      $value: true,
                    },
                    {
                      $operator: '<',
                      $value: 'now',
                      $field: 'startTime',
                    },
                    {
                      $operator: '>',
                      $value: 'now',
                      $field: 'endTime',
                    },
                  ],
                },
                $traverse: 'ancestors',
              },
              $sort: {
                $order: 'desc',
                $field: 'date',
              },
            },
          },
        },
        {
          // component: {
          //   $value: 'GridLarge',
          // },
          // title: {
          //   $value: 'Team Videos',
          // },
          children: {
            type: true,
            title: true,
            $list: {
              $limit: 10,
              $find: {
                $filter: [
                  {
                    $field: 'type',
                    $operator: '=',
                    $value: 'team',
                  },
                  {
                    $field: 'published',
                    $operator: '=',
                    $value: true,
                  },
                ],
                $find: {
                  $traverse: 'descendants',
                  $filter: [
                    {
                      $field: 'type',
                      $operator: '=',
                      $value: 'video',
                    },
                    {
                      $field: 'published',
                      $operator: '=',
                      $value: true,
                    },
                  ],
                },
                $traverse: 'ancestors',
              },
              $sort: {
                $order: 'desc',
                $field: 'date',
              },
            },
            id: true,
          },
        },
      ],
    },
    (r) => {
      otherResult2 = r
      console.warn('match layout 2', r)
    }
  )

  let otherResult3: any
  observe(
    t,
    {
      $id: 'sp1',
      id: true,
      $language: 'nl',
      type: true,
      ancestors: true,
      general: {
        $id: 'root',
        title: {
          $field: 'title',
        },
      },
      meta: {
        title: {
          $field: 'title',
        },
      },
      components: [
        {
          // component: {
          //   $value: 'Highlights',
          // },
          // title: {
          //   $value: 'Highlights',
          // },
          children: {
            title: true,
            $list: {
              $limit: 100,
              $find: {
                $filter: [
                  {
                    $operator: '=',
                    $value: 'folder',
                    $field: 'type',
                  },
                  {
                    $operator: '=',
                    $value: 'Highlights',
                    $field: 'name',
                  },
                ],
                $find: {
                  $traverse: 'descendants',
                  $filter: [
                    {
                      $operator: '=',
                      $value: true,
                      $field: 'published',
                    },
                  ],
                },
                $traverse: 'descendants',
              },
              $sort: {
                $order: 'desc',
                $field: 'date',
              },
            },
            homeTeam: {
              id: true,
              title: true,
            },
            awayTeam: {
              id: true,
              title: true,
            },
            // teams: [
            //   {
            //     id: true,
            //     $id: {
            //       $field: 'homeTeam'
            //     },
            //     title: true
            //   },
            //   {
            //     id: true,
            //     $id: {
            //       $field: 'awayTeam'
            //     },
            //     title: true
            //   }
            // ],
            date: true,
            type: true,
            id: true,
          },
        },
        {
          // component: {
          //   $value: 'Table',
          // },
          // title: {
          //   $value: 'Live Now',
          // },
          children: {
            homeTeam: {
              id: true,
              title: true,
            },
            awayTeam: {
              id: true,
              title: true,
            },
            // teams: [
            //   {
            //     id: true,
            //     $id: {
            //       $field: 'homeTeam'
            //     },
            //     title: true
            //   },
            //   {
            //     id: true,
            //     $id: {
            //       $field: 'awayTeam'
            //     },
            //     title: true
            //   }
            // ],
            type: true,
            title: true,
            date: true,
            startTime: true,
            id: true,
            $list: {
              $limit: 15,
              $find: {
                $traverse: 'descendants',
                $filter: [
                  {
                    $value: 'match',
                    $field: 'type',
                    $operator: '=',
                  },
                  {
                    $value: true,
                    $field: 'published',
                    $operator: '=',
                  },
                  {
                    $field: 'startTime',
                    $operator: '<',
                    $value: 'now',
                  },
                  {
                    $field: 'endTime',
                    $operator: '>',
                    $value: 'now',
                  },
                ],
              },
              $sort: {
                $order: 'desc',
                $field: 'date',
              },
            },
          },
        },
      ],
    },
    (r) => {
      otherResult3 = r
      console.warn('sport layout', r)
    }
  )

  await wait(1000)
  console.warn('should be upcoming')
  t.deepEqualIgnoreOrder(result, {
    upcoming: [{ id: 'mau1' }, { id: 'mau2' }].concat(
      upcomingPublishedIds.slice(0, 8)
    ),
    past: pastPublishedIds.slice(0, 10),
  })
  // t.deepEqualIgnoreOrder(otherResult1.components[0].children, [])
  t.deepEqualIgnoreOrder(otherResult1.components[1].children.length, 10)
  // t.deepEqualIgnoreOrder(otherResult2.components[0].children, [])
  t.deepEqualIgnoreOrder(otherResult2.components[1].children.length, 10)
  const pick = ({ id, type, ancestors, general, meta }) => ({
    id,
    type,
    ancestors,
    general,
    meta,
  })
  t.deepEqualIgnoreOrder(pick(otherResult3), {
    id: 'sp1',
    type: 'sport',
    ancestors: ['root'],
    general: {
      title: 'root',
    },
    meta: {
      title: 'sport one',
    },
  })
  t.deepEqualIgnoreOrder(otherResult3.components[0].children.length, 100)
  // t.deepEqualIgnoreOrder(otherResult3.components[1].children.length, 0)

  await wait(3000)

  console.warn('should be live')
  t.deepEqualIgnoreOrder(result, {
    upcoming: [{ id: 'mau2' }].concat(upcomingPublishedIds.slice(0, 9)),
    past: pastPublishedIds.slice(0, 10),
    live: [{ id: 'mau1' }],
  })
  t.deepEqualIgnoreOrder(otherResult1.components[0].children, [
    {
      id: 'mau1',
      type: 'match',
      homeTeam: { id: 'te1', title: 'team one' },
      awayTeam: { id: 'te2', title: 'team two' },
      // teams: [
      //   { id: 'te1', title: 'team one' },
      //   { id: 'te2', title: 'team two' }
      // ],
      title: 'upcoming match 1',
    },
  ])
  t.deepEqualIgnoreOrder(otherResult1.components[1].children.length, 10)
  t.deepEqualIgnoreOrder(otherResult2.components[0].children, [
    {
      id: 'mau1',
      type: 'match',
      homeTeam: { id: 'te1', title: 'team one' },
      awayTeam: { id: 'te2', title: 'team two' },
      // teams: [
      //   { id: 'te1', title: 'team one' },
      //   { id: 'te2', title: 'team two' }
      // ],
      title: 'upcoming match 1',
    },
  ])
  t.deepEqualIgnoreOrder(otherResult2.components[1].children.length, 10)
  t.deepEqualIgnoreOrder(pick(otherResult3), {
    id: 'sp1',
    type: 'sport',
    ancestors: ['root'],
    general: {
      title: 'root',
    },
    meta: {
      title: 'sport one',
    },
  })
  t.deepEqualIgnoreOrder(otherResult3.components[0].children.length, 100)
  t.deepEqualIgnoreOrder(otherResult3.components[1].children.length, 1)
  t.deepEqualIgnoreOrder(otherResult3.components[1].children[0].id, 'mau1')

  await wait(3000)

  console.warn('should be past')
  t.deepEqualIgnoreOrder(result, {
    upcoming: upcomingPublishedIds.slice(0, 10),
    past: [{ id: 'mau1' }].concat(pastPublishedIds.slice(0, 9)),
    live: [{ id: 'mau2' }],
  })
  t.deepEqualIgnoreOrder(otherResult1.components[0].children, [
    {
      id: 'mau2',
      type: 'match',
      homeTeam: { id: 'te1', title: 'team one' },
      awayTeam: { id: 'te2', title: 'team two' },
      // teams: [
      //   { id: 'te1', title: 'team one' },
      //   { id: 'te2', title: 'team two' }
      // ],
      title: 'upcoming match 2',
    },
  ])
  t.deepEqualIgnoreOrder(otherResult1.components[1].children.length, 10)
  t.deepEqualIgnoreOrder(otherResult2.components[0].children, [
    {
      id: 'mau2',
      type: 'match',
      homeTeam: { id: 'te1', title: 'team one' },
      awayTeam: { id: 'te2', title: 'team two' },
      // teams: [
      //   { id: 'te1', title: 'team one' },
      //   { id: 'te2', title: 'team two' }
      // ],
      title: 'upcoming match 2',
    },
  ])
  t.deepEqualIgnoreOrder(otherResult2.components[1].children.length, 10)
  t.deepEqualIgnoreOrder(pick(otherResult3), {
    id: 'sp1',
    type: 'sport',
    ancestors: ['root'],
    general: {
      title: 'root',
    },
    meta: {
      title: 'sport one',
    },
  })
  t.deepEqualIgnoreOrder(otherResult3.components[0].children.length, 100)
  t.deepEqualIgnoreOrder(otherResult3.components[1].children.length, 1)
  t.deepEqualIgnoreOrder(otherResult3.components[1].children[0].id, 'mau2')

  await wait(2000)

  t.deepEqualIgnoreOrder(result, {
    upcoming: upcomingPublishedIds.slice(0, 10),
    past: [{ id: 'mau1' }, { id: 'mau2' }].concat(pastPublishedIds.slice(0, 8)),
  })
  t.deepEqualIgnoreOrder(otherResult1.components[0].children, undefined)
  t.deepEqualIgnoreOrder(otherResult1.components[1].children.length, 10)
  t.deepEqualIgnoreOrder(otherResult2.components[0].children, undefined)
  t.deepEqualIgnoreOrder(otherResult2.components[1].children.length, 10)
  t.deepEqualIgnoreOrder(pick(otherResult3), {
    id: 'sp1',
    type: 'sport',
    ancestors: ['root'],
    general: {
      title: 'root',
    },
    meta: {
      title: 'sport one',
    },
  })
  t.deepEqualIgnoreOrder(otherResult3.components[0].children.length, 100)
  t.deepEqualIgnoreOrder(otherResult3.components[1].children.length, 0)
})
