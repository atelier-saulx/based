import anyTest, { TestFn } from 'ava'
import { BasedDbClient, protocol } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions/index.js'
import getPort from 'get-port'
import { find } from './assertions/utils.js'
import { SelvaTraversal } from '../src/protocol/index.js'
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
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('find - traverse expression - low level', async (t) => {
  const { client } = t.context

  await t.context.client.updateSchema({
    language: 'en',
    types: {
      library: {
        prefix: 'li',
        fields: {
          name: { type: 'string' },
          books: {
            type: 'references',
            bidirectional: {
              fromField: 'library',
            },
          },
        },
      },
      book: {
        prefix: 'bk',
        fields: {
          name: { type: 'string' },
          library: {
            type: 'reference',
            bidirectional: {
              fromField: 'books',
            },
          },
          author: {
            type: 'reference',
            bidirectional: {
              fromField: 'books',
            },
          },
          publisher: {
            type: 'reference',
            bidirectional: {
              fromField: 'books',
            },
          },
          publishedAt: { type: 'timestamp' },
        },
      },
      publisher: {
        prefix: 'pb',
        fields: {
          name: { type: 'string' },
          books: {
            type: 'references',
            bidirectional: {
              fromField: 'publisher',
            },
          },
        },
      },
      author: {
        prefix: 'au',
        fields: {
          name: { type: 'string' },
          books: {
            type: 'references',
            bidirectional: {
              fromField: 'author',
            },
          },
        },
      },
    },
  })

  // A small delay is needed after setting the schema
  await new Promise((r) => setTimeout(r, 100))

  const alexandria = await client.set({
    $language: 'en',
    type: 'publisher',
    $id: 'pb08523c44',
    name: 'The Great Library of Alexandria in Alexandria',
  })
  const agrippina = await client.set({
    $language: 'en',
    type: 'author',
    $id: 'aud11d986e',
    name: 'Agrippina the Younger',
  })
  const democritus = await client.set({
    $language: 'en',
    type: 'author',
    $id: 'au3c163ed6',
    name: 'Democritus',
  })

  const date = new Date()
  date.setMonth(0)
  date.setDate(1)

  const booksIds = await Promise.all(
    [
      {
        $language: 'en',
        type: 'book',
        $id: 'bk5b0985b0',
        name: 'Septuagint',
        publisher: alexandria,
        publishedAt: date.setFullYear(1972),
      },
      {
        $language: 'en',
        type: 'book',
        $id: 'bkcbbde08f',
        name: 'Geometrical Reality',
        author: democritus,
        publishedAt: date.setFullYear(1980),
      },
      {
        $language: 'en',
        type: 'book',
        $id: 'bkcfcc6a0d',
        name: 'Geometrical Reality',
        author: democritus,
        publishedAt: date.setFullYear(1990),
      },
      {
        $language: 'en',
        type: 'book',
        $id: 'bkf38955bb',
        name: 'Casus Suorum',
        author: agrippina,
        publisher: alexandria,
        publishedAt: date.setFullYear(2010),
      },
    ].map((b) => client.set(b))
  )
  await client.set({
    type: 'library',
    name: 'The Great Library of Alexandria in Alexandria',
    books: booksIds,
  })

  t.log(
    '0000',
    await client.get({
      $id: 'bk5b0985b0',
      name: true,
      publisher: true,
    })
  )
  const traversal =
    '{"children"} {"author","publisher"} j "bk" e T {"books"} "li" e T'
  const filter = '$0 b {"bk","au","pb"} a'
  t.deepEqual(
    // await client.redis.selva_hierarchy_find(
    //   '',
    //   '___selva_hierarchy',
    //   'bfs_expression',
    //   traversal,
    //   'order',
    //   'type',
    //   'asc',
    //   'fields',
    //   'type\nname\nauthor|publisher',
    //   'root',
    //   filter
    // ),
    (
      await find({
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str: 'type\nname\nauthor|publisher',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION,
        dir_opt_str: traversal,
        id: 'root',
        rpn: [filter],
      })
    )[0],
    [
      ['au3c163ed6', ['type', 'author', 'name', 'Democritus']],
      ['aud11d986e', ['type', 'author', 'name', 'Agrippina the Younger']],
      [
        'bk5b0985b0',
        ['type', 'book', 'name', 'Septuagint', 'publisher', ['pb08523c44']],
      ],
      [
        'bkcbbde08f',
        [
          'type',
          'book',
          'name',
          'Geometrical Reality',
          'author',
          ['au3c163ed6'],
        ],
      ],
      [
        'bkcfcc6a0d',
        [
          'type',
          'book',
          'name',
          'Geometrical Reality',
          'author',
          ['au3c163ed6'],
        ],
      ],
      [
        'bkf38955bb',
        ['type', 'book', 'name', 'Casus Suorum', 'author', ['aud11d986e']],
      ],
      [
        'pb08523c44',
        [
          'type',
          'publisher',
          'name',
          'The Great Library of Alexandria in Alexandria',
        ],
      ],
    ]
  )
})

test('find - traverse expression with records', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    types: {
      book: {
        prefix: 'bk',
        fields: {
          name: { type: 'string' },
          revisions: {
            type: 'array',
            values: {
              type: 'object',
              properties: {
                version: { type: 'string' },
                publishedAt: { type: 'timestamp' },
                contents: { type: 'reference' },
              },
            },
          },
        },
      },
      section: {
        prefix: 'sc',
        fields: {
          name: { type: 'text' },
          text: { type: 'text' },
          revisionedChildren: {
            type: 'record',
            values: {
              type: 'references',
            },
          },
        },
      },
    },
  })

  // A small delay is needed after setting the schema
  await new Promise((r) => setTimeout(r, 100))

  const book = await client.set({
    $language: 'en',
    type: 'book',
    name: 'Liber Optimus',
    revisions: [
      {
        version: 'v1',
        publishedAt: new Date('2000').getTime(),
        contents: {
          type: 'section',
          $id: 'sc1',
          name: 'Preface',
          text: 'Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...',
          revisionedChildren: {
            v1: [
              {
                $id: 'sc2',
                type: 'section',
                name: '1. Prologue',
                text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
              },
              {
                $id: 'sc3',
                type: 'section',
                name: '5. Epilogue',
                text: 'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?',
              },
            ],
          },
        },
      },
    ],
  })
  await client.set({
    $id: 'sc1',
    $language: 'en',
    revisionedChildren: {
      v2: [
        {
          $id: 'sc4',
          type: 'section',
          name: '1. Prologue',
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        },
        {
          $id: 'sc5',
          type: 'section',
          name: '2. Epilogue',
          text: 'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?',
        },
      ],
    },
  })

  // TODO This doesn't currently work
  //const sections = await client.get({
  //  $id: 'sc1',
  //  name: true,
  //  revisionedChildren: {
  //    '*': {
  //      $all: true,
  //      $list: true,
  //    },
  //  },
  //})

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $id: 'sc1',
      name: true,
      revisionedChildren: true,
    }),
    {
      name: 'Preface',
      revisionedChildren: {
        v1: ['sc2', 'sc3'],
        v2: ['sc4', 'sc5'],
      },
    }
  )

  // TODO recursive expressions not supported yet so we can't select the version nicely
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: book,
      $language: 'en',
      sections: {
        name: true,
        $list: {
          $find: {
            $recursive: true,
            $traverse: {
              book: 'revisions[0].contents',
              section: 'revisionedChildren.v2',
              $any: false,
            },
          },
        },
      },
    }),
    {
      sections: [
        { name: 'Preface' },
        { name: '1. Prologue' },
        { name: '2. Epilogue' },
      ],
    }
  )

  await client.set({
    $id: 'sc1',
    $language: 'en',
    revisionedChildren: {
      v3: [
        {
          $id: 'sc6',
          type: 'section',
          name: 'Prologue',
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        },
        {
          $id: 'sc7',
          type: 'section',
          name: 'Epilogue',
          text: 'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?',
        },
      ],
    },
  })

  t.deepEqual(
    // await client.redis.selva_hierarchy_find(
    //   'en',
    //   '___selva_hierarchy',
    //   'bfs_expression',
    //   '"bk" e >1 "v2" "lJ" "revisionedChildren" o Z .1:{"revisions[0].contents"}',
    //   //'"bk" e >1 "revisionedChildren.v2" h L >2 {"revisionedChildren.v2"} Z .2:"revisionedChildren.v1" h L >3 {"revisionedChildren.v1"} Z .3:{} Z .1:{"revisions[0].contents"}',
    //   'fields',
    //   'name',
    //   book,
    //   '"sc" e'
    // )
    (
      await find({
        lang: 'en',
        client,
        res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        res_opt_str: 'name',
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION,
        dir_opt_str:
          '"bk" e >1 "v2" "lJ" "revisionedChildren" o Z .1:{"revisions[0].contents"}',
        id: book,
        rpn: ['"sc" e'],
      })
    )[0],
    [
      ['sc1', ['name', 'Preface']],
      ['sc4', ['name', '1. Prologue']],
      ['sc5', ['name', '2. Epilogue']],
    ]
  )
})

test('find - versioned hierarchies', async (t) => {
  const { client } = t.context
  const versionedHierarchyFields: any = {
    versionedChildren: {
      type: 'record',
      values: {
        type: 'references',
        // TODO
        // bidirectional: {
        //   fromField: 'versionedParents',
        // },
      },
    },
    versionedParents: {
      type: 'record',
      values: {
        type: 'references',
        // TODO
        // bidirectional: {
        //   fromField: 'versionedChildren',
        // },
      },
    },
  }

  await client.updateSchema({
    language: 'en',
    types: {
      category: {
        prefix: 'ca',
        fields: {
          name: { type: 'string' },
          title: { type: 'text' },
          description: { type: 'text' },
          ...versionedHierarchyFields,
        },
      },
      post: {
        prefix: 'po',
        fields: {
          name: { type: 'string' },
          title: { type: 'text' },
          description: { type: 'text' },
          ...versionedHierarchyFields,
        },
      },
    },
  })

  const cooking = await client.set({
    $language: 'en',
    type: 'category',
    name: 'Cooking',
    description: 'Food, tasty',
    versionedChildren: { v1: ['po1', 'po2'] },
  })

  await client.set({
    $id: 'po1',
    $language: 'en',
    name: 'Food 1',
    description: 'Nice food 1',
    versionedParents: {
      v1: [cooking],
    },
  })

  await client.set({
    $id: 'po2',
    $language: 'en',
    name: 'Food 2',
    description: 'Nice food 2',
    versionedParents: {
      v1: [cooking],
    },
  })

  // change hierarchy and stuff
  const travel = await client.set({
    $language: 'en',
    type: 'category',
    name: 'Travel',
    description: 'Travel, crazy',
    versionedChildren: {
      v2: ['po2v2'],
    },
  })

  await client.set({
    $id: cooking,
    versionedChildren: {
      v2: ['po1'],
    },
  })

  await client.set({
    $id: 'po2v2',
    $language: 'en',
    name: 'Travel 1',
    parents: ['po1'],
    versionedParents: {
      v2: [travel],
    },
  })

  const responses: any = []
  for (let i = 1; i <= 2; i++) {
    const q = {
      things: {
        name: { $inherit: true },
        description: { $inherit: true },
        $list: {
          $find: {
            $recursive: true,
            $traverse: {
              root: 'children',
              $any: {
                $fn: 'maxRecordKeyLEQ',
                $args: ['versionedChildren', 'v' + i],
              },
            },
          },
        },
      },
    }

    const res = await client.get({
      $language: 'en',
      cooking: {
        $id: cooking,
        ...q,
      },

      travel: {
        $id: travel,
        ...q,
      },
    })

    responses.push(res)

    console.log('RES', i, JSON.stringify(res, null, 2))
  }

  deepEqualIgnoreOrder(t, responses, [
    {
      cooking: {
        things: [
          {
            name: 'Food 1',
            description: 'Nice food 1',
          },
          {
            name: 'Food 2',
            description: 'Nice food 2',
          },
        ],
      },
      travel: {
        things: [],
      },
    },
    {
      cooking: {
        things: [
          {
            name: 'Food 1',
            description: 'Nice food 1',
          },
        ],
      },
      travel: {
        things: [
          {
            name: 'Travel 1',
            description: 'Nice food 1',
          },
        ],
      },
    },
  ])

  // A small delay is needed after setting the schema
  await new Promise((r) => setTimeout(r, 100))
})
