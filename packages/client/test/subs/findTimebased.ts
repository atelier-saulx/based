import { basicTest, deepEqualIgnoreOrder } from '../assertions'
import { subscribe } from '@based/db-subs'
import { wait } from '@saulx/utils'

const test = basicTest({
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

test('subs layout', async (t) => {
  const client = t.context.client

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

  subscribe(
    client,
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
    (_r: any) => {
      // console.info(r)
    }
  )

  subscribe(
    client,
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
    (_r: any) => {
      // console.info(r)
    }
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
  subscribe(
    client,
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
    (r: any) => {
      result = r
      // console.info('-->', result)
    }
  )

  let otherResult1: any
  subscribe(
    client,
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
    (r: any) => {
      otherResult1 = r
      // console.warn('match layout 1', r)
    }
  )

  let otherResult2: any
  subscribe(
    client,
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
    (r: any) => {
      otherResult2 = r
      // console.warn('match layout 2', r)
    }
  )

  let otherResult3: any
  subscribe(
    client,
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
    (r: any) => {
      otherResult3 = r
      // console.warn('sport layout', r)
    }
  )

  await wait(1000)
  // console.warn('should be upcoming')
  deepEqualIgnoreOrder(t, result, {
    upcoming: [{ id: 'mau1' }, { id: 'mau2' }].concat(
      upcomingPublishedIds.slice(0, 8)
    ),
    live: [],
    past: pastPublishedIds.slice(0, 10),
  })
  // deepEqualIgnoreOrder(t,otherResult1.components[0].children, [])
  deepEqualIgnoreOrder(t, otherResult1.components[1].children.length, 10)
  // deepEqualIgnoreOrder(t,otherResult2.components[0].children, [])
  deepEqualIgnoreOrder(t, otherResult2.components[1].children.length, 10)
  const pick = ({ id, type, ancestors, general, meta }) => ({
    id,
    type,
    ancestors,
    general,
    meta,
  })
  deepEqualIgnoreOrder(t, pick(otherResult3), {
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
  deepEqualIgnoreOrder(t, otherResult3.components[0].children.length, 100)
  // deepEqualIgnoreOrder(t,otherResult3.components[1].children.length, 0)

  await wait(3000)

  // console.warn('should be live')
  deepEqualIgnoreOrder(t, result, {
    upcoming: [{ id: 'mau2' }].concat(upcomingPublishedIds.slice(0, 9)),
    past: pastPublishedIds.slice(0, 10),
    live: [{ id: 'mau1' }],
  })
  deepEqualIgnoreOrder(t, otherResult1.components[0].children, [
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
  deepEqualIgnoreOrder(t, otherResult1.components[1].children.length, 10)
  deepEqualIgnoreOrder(t, otherResult2.components[0].children, [
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
  deepEqualIgnoreOrder(t, otherResult2.components[1].children.length, 10)
  deepEqualIgnoreOrder(t, pick(otherResult3), {
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
  deepEqualIgnoreOrder(t, otherResult3.components[0].children.length, 100)
  deepEqualIgnoreOrder(t, otherResult3.components[1].children.length, 1)
  deepEqualIgnoreOrder(t, otherResult3.components[1].children[0].id, 'mau1')

  await wait(3000)

  // console.warn('should be past')
  deepEqualIgnoreOrder(t, result, {
    upcoming: upcomingPublishedIds.slice(0, 10),
    past: [{ id: 'mau1' }].concat(pastPublishedIds.slice(0, 9)),
    live: [{ id: 'mau2' }],
  })
  deepEqualIgnoreOrder(t, otherResult1.components[0].children, [
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
  deepEqualIgnoreOrder(t, otherResult1.components[1].children.length, 10)
  deepEqualIgnoreOrder(t, otherResult2.components[0].children, [
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
  deepEqualIgnoreOrder(t, otherResult2.components[1].children.length, 10)
  deepEqualIgnoreOrder(t, pick(otherResult3), {
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
  deepEqualIgnoreOrder(t, otherResult3.components[0].children.length, 100)
  deepEqualIgnoreOrder(t, otherResult3.components[1].children.length, 1)
  deepEqualIgnoreOrder(t, otherResult3.components[1].children[0].id, 'mau2')

  await wait(2000)

  deepEqualIgnoreOrder(t, result, {
    upcoming: upcomingPublishedIds.slice(0, 10),
    live: [],
    past: [{ id: 'mau1' }, { id: 'mau2' }].concat(pastPublishedIds.slice(0, 8)),
  })
  deepEqualIgnoreOrder(t, otherResult1.components[1].children.length, 10)
  deepEqualIgnoreOrder(t, otherResult2.components[1].children.length, 10)
  deepEqualIgnoreOrder(t, pick(otherResult3), {
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
  deepEqualIgnoreOrder(t, otherResult3.components[0].children.length, 100)
  deepEqualIgnoreOrder(t, otherResult3.components[1].children.length, 0)
})
