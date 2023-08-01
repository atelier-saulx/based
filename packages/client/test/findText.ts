import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (t) => {
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
    languages: ['en', 'de', 'nl', 'it'],
    types: {
      league: {
        prefix: 'le',
        fields: {
          title: { type: 'text' },
          name: { type: 'string' },
          value: { type: 'number' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
          name: { type: 'string' },
          value: { type: 'number' },
        },
      },
      ticket: {
        prefix: 'tk',
        fields: {
          title: { type: 'text' },
          name: { type: 'string' },
        },
      },
    },
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

// TODO: filters not handling text fields
test.serial.skip('find fields with a substring match', async (t) => {
  await Promise.all(
    [
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Amanpreet Bennett',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Ozan Weston',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Alejandro Hackett',
      },
      {
        type: 'ticket',
        title: { en: 'Game Two' },
        name: 'Dane Bray',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Lyndsey Hackett',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Chandler Hackett',
      },
      {
        type: 'ticket',
        title: { en: 'Game Two' },
        name: 'Harold Pate',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Stella Cisneros',
      },
      {
        type: 'ticket',
        title: { en: 'Game Two' },
        name: 'Norman Hackett',
      },
      {
        type: 'ticket',
        title: { en: 'Game One' },
        name: 'Rikesh Frey',
      },
    ].map((v) => client.set(v))
  )

  const r = await client.get({
    descendants: {
      title: true,
      name: true,
      $list: {
        $sort: { $field: 'name', $order: 'asc' },
        $find: {
          $filter: [
            {
              $operator: 'includes',
              $field: 'name',
              $value: 'Hackett',
            },
          ],
        },
      },
    },
  })
  t.deepEqual(r, {
    descendants: [
      {
        title: { en: 'Game One' },
        name: 'Alejandro Hackett',
      },
      {
        title: { en: 'Game One' },
        name: 'Chandler Hackett',
      },
      {
        title: { en: 'Game One' },
        name: 'Lyndsey Hackett',
      },
      {
        title: { en: 'Game Two' },
        name: 'Norman Hackett',
      },
    ],
  })

  t.deepEqual(
    await client.get({
      // $language: 'en',
      descendants: {
        title: true,
        name: true,
        $list: {
          $sort: { $field: 'name', $order: 'asc' },
          $find: {
            $filter: [
              {
                $operator: 'includes',
                $field: 'title',
                $value: 'One',
              },
            ],
          },
        },
      },
    }),
    {
      descendants: [
        {
          name: 'Alejandro Hackett',
          title: 'Game One',
        },
        {
          name: 'Amanpreet Bennett',
          title: 'Game One',
        },
        {
          name: 'Chandler Hackett',
          title: 'Game One',
        },
        {
          name: 'Lyndsey Hackett',
          title: 'Game One',
        },
        {
          name: 'Ozan Weston',
          title: 'Game One',
        },
        {
          name: 'Rikesh Frey',
          title: 'Game One',
        },
        {
          name: 'Stella Cisneros',
          title: 'Game One',
        },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $language: 'en',
      descendants: {
        title: true,
        name: true,
        $list: {
          $sort: { $field: 'name', $order: 'asc' },
          $find: {
            $filter: [
              {
                $operator: 'includes',
                $field: 'title',
                $value: 'On',
              },
            ],
          },
        },
      },
    }),
    {
      descendants: [
        {
          name: 'Alejandro Hackett',
          title: 'Game One',
        },
        {
          name: 'Amanpreet Bennett',
          title: 'Game One',
        },
        {
          name: 'Chandler Hackett',
          title: 'Game One',
        },
        {
          name: 'Lyndsey Hackett',
          title: 'Game One',
        },
        {
          name: 'Ozan Weston',
          title: 'Game One',
        },
        {
          name: 'Rikesh Frey',
          title: 'Game One',
        },
        {
          name: 'Stella Cisneros',
          title: 'Game One',
        },
      ],
    }
  )
})

// TODO: filters not handling text fields
// old TODO: this needs to use a non-TEXT-lANGUAGE-SUG field
test.serial.skip('find - exact text match on exact field', async (t) => {
  // simple nested - single query
  await client.set({
    type: 'match',
    name: 'match 1',
    title: {
      en: 'a nice match',
    },
  })

  await client.set({
    type: 'match',
    name: 'match 2',
    title: {
      en: 'greatest match',
    },
  })

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'greatest match',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['match 2']
  )

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'nice match',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['match 1']
  )

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'match',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['match 1', 'match 2']
  )
})

// TODO: filters not handling text fields
test.serial.skip('find - find with suggestion', async (t) => {
  // simple nested - single query
  await client.set({
    type: 'league',
    name: 'league 1',
    title: {
      en: 'a nice league',
    },
  })

  await client.set({
    type: 'league',
    name: 'league 2',
    title: {
      en: 'greatest league',
    },
  })

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'great',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['league 2']
  )

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'nic',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['league 1']
  )

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'league',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['league 1', 'league 2']
  )
})

// TODO: filters not handling text fields
// skipped on old tests
test.serial.skip(
  'find - find with suggestion containing special characters',
  async (t) => {
    // simple nested - single query
    await client.set({
      type: 'league',
      name: 'league 1',
      title: {
        en: 'äitin mussukoiden nappula liiga 😂👌',
      },
    })

    await client.set({
      type: 'league',
      name: 'league 2',
      title: {
        en: '🐂 münchen mädness liiga 💥',
      },
    })

    t.deepEqualIgnoreOrder(
      (
        await client.get({
          $id: 'root',
          $language: 'en',
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
                    $field: 'title',
                    $operator: '=',
                    $value: 'munch',
                  },
                ],
              },
            },
          },
        })
      ).items.map((x) => x.name),
      ['league 2']
    )

    t.deepEqualIgnoreOrder(
      (
        await client.get({
          $id: 'root',
          $language: 'en',
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
                    $field: 'title',
                    $operator: '=',
                    $value: 'madn',
                  },
                ],
              },
            },
          },
        })
      ).items.map((x) => x.name),
      ['league 2']
    )

    t.deepEqualIgnoreOrder(
      (
        await client.get({
          $id: 'root',
          $language: 'en',
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
                    $field: 'title',
                    $operator: '=',
                    $value: 'aiti',
                  },
                ],
              },
            },
          },
        })
      ).items.map((x) => x.name),
      ['league 1']
    )

    t.deepEqualIgnoreOrder(
      (
        await client.get({
          $id: 'root',
          $language: 'en',
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
                    $field: 'title',
                    $operator: '=',
                    $value: 'liiga',
                  },
                ],
              },
            },
          },
        })
      ).items.map((x) => x.name),
      ['league 1', 'league 2']
    )
  }
)

// TODO: filters not handling text fields
// skipped on old tests
test.serial.skip('find - find with another language', async (t) => {
  // simple nested - single query
  const l1 = await client.set({
    type: 'league',
    name: 'league 1',
    title: {
      // en: 'yes nice league',
      nl: 'yesh mooie competitie',
      it: 'pallacanestro',
    },
  })

  const l2 = await client.set({
    type: 'league',
    name: 'league 2',
    title: {
      de: 'yesh german league',
    },
  })

  await client.set({
    $id: l1,
    type: 'league',
    name: 'league 1',
    title: {
      en: 'yes nice league',
    },
  })

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'nice',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['league 1']
  )

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'nl',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'mooie',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['league 1']
  )

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'de',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'nice',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['league 1']
  )

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'german',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['league 2']
  )

  await client.set({
    $id: l2,
    title: {
      en: 'yesh en league',
    },
  })

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'german',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    []
  )

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'de',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'german',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['league 2']
  )

  t.deepEqualIgnoreOrder(
    (
      await client.get({
        $id: 'root',
        $language: 'nl',
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
                  $field: 'title',
                  $operator: '=',
                  $value: 'en league',
                },
              ],
            },
          },
        },
      })
    ).items.map((x) => x.name),
    ['league 2']
  )
})

// TODO: filters not handling text fields
// skipped on old tests
test.serial.skip(
  'find - find with suggestion starting with whitespace',
  async (t) => {
    // simple nested - single query
    await client.set({
      type: 'league',
      name: 'league 1',
      title: {
        en: ' a nice league',
      },
    })

    await client.set({
      type: 'league',
      name: 'league 2',
      title: {
        en: '  greatest   league',
      },
    })

    t.deepEqualIgnoreOrder(
      (
        await client.get({
          $id: 'root',
          $language: 'en',
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
                    $field: 'title',
                    $operator: '=',
                    $value: ' great',
                  },
                ],
              },
            },
          },
        })
      ).items.map((x) => x.name),
      ['league 2']
    )

    t.deepEqualIgnoreOrder(
      (
        await client.get({
          $id: 'root',
          $language: 'en',
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
                    $field: 'title',
                    $operator: '=',
                    $value: '   nic     ',
                  },
                ],
              },
            },
          },
        })
      ).items.map((x) => x.name),
      ['league 1']
    )

    t.deepEqualIgnoreOrder(
      (
        await client.get({
          $id: 'root',
          $language: 'en',
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
                    $field: 'title',
                    $operator: '=',
                    $value: '   league',
                  },
                ],
              },
            },
          },
        })
      ).items.map((x) => x.name),
      ['league 1', 'league 2']
    )

    try {
      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: '*  ',
                },
              ],
            },
          },
        },
      })

      await client.get({
        $id: 'root',
        $language: 'en',
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
                  $field: 'title',
                  $operator: '=',
                  $value: '',
                },
              ],
            },
          },
        },
      })
    } catch (e) {
      console.error(e)
      t.fail()
    }
  }
)
