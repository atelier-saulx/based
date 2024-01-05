import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
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
    translations: [/* 'en_us', 'en_uk',*/ 'de', 'nl'],
    root: {
      fields: {
        value: { type: 'number' },
      },
    },
    types: {
      logo: {
        prefix: 'lo',
        fields: {
          name: { type: 'string' },
          bidirClub: {
            type: 'reference',
            bidirectional: {
              fromField: 'bidirLogo',
            },
          },
        },
      },
      club: {
        prefix: 'cl',
        fields: {
          specialMatch: { type: 'reference' },
          bidirMatches: {
            type: 'references',
            bidirectional: {
              fromField: 'bidirClub',
            },
          },
          relatedClubs: {
            type: 'references',
            bidirectional: {
              fromField: 'relatedClubs',
            },
          },
          bidirLogo: {
            type: 'reference',
            bidirectional: {
              fromField: 'bidirClub',
            },
          },
          nested: {
            type: 'object',
            properties: {
              specialMatch: { type: 'reference' },
            },
          },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          value: { type: 'number' },
          title: { type: 'text' },
          description: { type: 'text' },
          bidirClub: {
            type: 'reference',
            bidirectional: {
              fromField: 'bidirMatches',
            },
          },
        },
      },
    },
  })

  console.dir(await t.context.client.command('hierarchy.listConstraints'), {
    depth: 8,
  })
  console.dir(await t.context.client.command('hierarchy.types.list'), {
    depth: 8,
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('simple singular reference', async (t) => {
  const { client } = t.context
  // const match1 = await client.set({
  //   $id: 'maA',
  //   title: {
  //     en: 'yesh match'
  //   }
  // })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: match1
  // })

  const specialMatch = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
    parents: ['clA'],
  })
  await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    // specialMatch: {
    //   $id: 'maA',
    //   title: {
    //     en: 'yesh match',
    //   },
    // },
    specialMatch,
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: true,
    }),
    {
      title: 'yesh club',
      specialMatch: 'maA',
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: {
        title: true,
        description: { $default: 'no description' },
      },
    }),
    {
      title: 'yesh club',
      specialMatch: {
        title: 'yesh match',
        description: 'no description',
      },
    }
  )
})

test('singular reference inherit', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maB',
    value: 112,
  })

  const match1 = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
    parents: {
      $add: 'maB',
    },
  })

  await client.set({
    $id: 'clB',
    title: {
      en: 'yesh club 2',
    },
    specialMatch: 'maB',
  })

  await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    parents: {
      $add: 'clB',
    },
    specialMatch: match1,
  })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: {
  //     $id: 'maA',
  //     title: {
  //       en: 'yesh match'
  //     }
  //   }
  // })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: {
        title: true,
        // value: { $inherit: { $type: ['match', 'club'] } }
        value: { $inherit: true },
      },
    }),
    {
      title: 'yesh club',
      specialMatch: {
        title: 'yesh match',
        value: 112,
      },
    }
  )
})

test('singular reference $field', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
  })

  await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    specialMatch: match1,
  })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: {
  //     $id: 'maA',
  //     title: {
  //       en: 'yesh match'
  //     }
  //   }
  // })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      match: {
        $field: 'specialMatch',
        title: true,
      },
    }),
    {
      title: 'yesh club',
      match: {
        title: 'yesh match',
      },
    }
  )
})

test('list of simple singular reference', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
  })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: match1
  // })

  await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    // specialMatch: {
    //   $id: 'maA',
    //   title: {
    //     en: 'yesh match',
    //   },
    // },
    specialMatch: match1,
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: true,
    }),
    {
      title: 'yesh club',
      specialMatch: 'maA',
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: {
        title: true,
        description: { $default: 'no description' },
      },
    }),
    {
      title: 'yesh club',
      specialMatch: {
        title: 'yesh match',
        description: 'no description',
      },
    }
  )

  const result = await client.get({
    $id: 'root',
    $language: 'en',
    children: {
      id: true,
      title: true,
      parents: true,
      specialMatch: {
        id: true,
        title: true,
      },
      $list: {
        $find: {
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'club',
            },
          ],
        },
      },
    },
  })

  console.log(JSON.stringify(result, null, 2))
  t.deepEqual(result, {
    children: [
      {
        id: 'clA',
        title: 'yesh club',
        parents: ['root'],
        specialMatch: { id: 'maA', title: 'yesh match' },
      },
    ],
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      $language: 'en',
      children: {
        $all: true,
        createdAt: false,
        updatedAt: false,
        parents: true,
        specialMatch: {
          id: true,
          title: true,
        },
        $list: {
          $find: {
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'club',
              },
            ],
          },
        },
      },
    }),
    {
      children: [
        {
          id: 'clA',
          type: 'club',
          parents: ['root'],
          title: 'yesh club',
          specialMatch: { id: 'maA', title: 'yesh match' },
        },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'clA',
      $all: true,
      createdAt: false,
      updatedAt: false,
      specialMatch: {
        $all: true,
        createdAt: false,
        updatedAt: false,
      },
    }),
    {
      id: 'clA',
      type: 'club',
      title: { en: 'yesh club' },
      specialMatch: {
        id: 'maA',
        title: { en: 'yesh match' },
        type: 'match',
      },
    }
  )

  await client.set({
    $id: 'maA',
    bidirClub: 'clA',
  })

  t.deepEqual(
    await client.get({
      $id: 'clA',
      $all: true,
      createdAt: false,
      updatedAt: false,
      specialMatch: {
        $all: true,
        createdAt: false,
        updatedAt: false,
        bidirClub: {
          $all: true,
          createdAt: false,
          updatedAt: false,
        },
      },
    }),
    {
      id: 'clA',
      type: 'club',
      title: { en: 'yesh club' },
      specialMatch: {
        id: 'maA',
        title: { en: 'yesh match' },
        type: 'match',
        bidirClub: {
          id: 'clA',
          type: 'club',
          title: { en: 'yesh club' },
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      $language: 'en',
      children: {
        $all: true,
        createdAt: false,
        updatedAt: false,
        specialMatch: {
          $all: true,
          createdAt: false,
          updatedAt: false,
        },
        $list: {
          $find: {
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'club',
              },
            ],
          },
        },
      },
    }),
    {
      children: [
        {
          id: 'clA',
          type: 'club',
          title: 'yesh club',
          specialMatch: { id: 'maA', title: 'yesh match', type: 'match' },
        },
      ],
    }
  )
})

test('simple singular bidirectional reference', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    bidirMatches: [
      {
        $id: 'maA',
        title: {
          en: 'yesh match',
        },
      },
      {
        $id: 'maB',
        title: {
          en: 'yesh match 2',
        },
      },
    ],
    bidirLogo: {
      $id: 'lo1',
      name: 'logo 1',
    },
  })

  await client.set({
    $id: 'clB',
    title: {
      en: 'yesh club 2',
    },
    relatedClubs: {
      $add: 'clA',
    },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      $language: 'en',
      id: true,
      title: true,
      bidirClub: {
        id: true,
        title: true,
        logo: {
          $field: 'bidirLogo',
          name: true,
        },
      },
    }),
    {
      id: 'maA',
      title: 'yesh match',
      bidirClub: {
        id: 'clA',
        title: 'yesh club',
        logo: {
          name: 'logo 1',
        },
      },
    }
  )

  await client.set({
    $id: 'clA',
    bidirMatches: {
      $remove: 'maA',
    },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      $language: 'en',
      id: true,
      title: true,
      bidirClub: {
        id: true,
        title: true,
        logo: {
          $field: 'bidirLogo',
          name: true,
        },
      },
    }),
    {
      id: 'maA',
      title: 'yesh match',
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      bidirMatches: {
        id: true,
        title: true,
        $list: true,
      },
      bidirLogo: {
        id: true,
        name: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      bidirMatches: [
        {
          id: 'maB',
          title: 'yesh match 2',
        },
      ],
      bidirLogo: {
        id: 'lo1',
        name: 'logo 1',
      },
    }
  )

  await client.set({
    $id: 'clA',
    bidirLogo: {
      $delete: true,
    },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      bidirMatches: {
        id: true,
        title: true,
        $list: true,
      },
      bidirLogo: {
        id: true,
        name: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      bidirMatches: [
        {
          id: 'maB',
          title: 'yesh match 2',
        },
      ],
    }
  )

  await client.set({
    $id: 'maB',
    bidirClub: { $delete: true },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      bidirMatches: {
        id: true,
        title: true,
        $list: true,
      },
      bidirLogo: {
        id: true,
        name: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      bidirMatches: [],
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      relatedClubs: {
        id: true,
        title: true,
        $list: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      relatedClubs: [
        {
          id: 'clB',
          title: 'yesh club 2',
        },
      ],
    }
  )

  await client.set({
    $id: 'clB',
    relatedClubs: {
      $remove: 'clA',
    },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      relatedClubs: {
        id: true,
        title: true,
        $list: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      relatedClubs: [],
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clB',
      $language: 'en',
      id: true,
      title: true,
      relatedClubs: {
        id: true,
        title: true,
        $list: true,
      },
    }),
    {
      id: 'clB',
      title: 'yesh club 2',
      relatedClubs: [],
    }
  )
})

test('list of simple singular reference with $field usage', async (t) => {
  const { client } = t.context
  // const match1 = await client.set({
  //   $id: 'maA',
  //   title: {
  //     en: 'yesh match'
  //   }
  // })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: match1
  // })

  await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    specialMatch: {
      $id: 'maA',
      title: {
        en: 'yesh match',
      },
    },
  })

  let result = await client.get({
    $id: 'root',
    $language: 'en',
    children: {
      id: true,
      title: true,
      parents: true,
      match: {
        id: { $field: 'specialMatch.id' },
        title: { $field: 'specialMatch.title' },
      },
      $list: {
        $find: {
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'club',
            },
          ],
        },
      },
    },
  })

  console.log(JSON.stringify(result, null, 2))
  t.deepEqual(result, {
    children: [
      {
        id: 'clA',
        title: 'yesh club',
        parents: ['root'],
        match: { id: 'maA', title: 'yesh match' },
      },
    ],
  })

  result = await client.get({
    $id: 'root',
    $language: 'en',
    children: {
      id: true,
      title: true,
      parents: true,
      match: {
        $field: 'specialMatch',
        id: true,
        title: true,
      },
      $list: {
        $find: {
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'club',
            },
          ],
        },
      },
    },
  })

  console.log(JSON.stringify(result, null, 2))
  t.deepEqual(result, {
    children: [
      {
        id: 'clA',
        title: 'yesh club',
        parents: ['root'],
        match: { id: 'maA', title: 'yesh match' },
      },
    ],
  })
})

test('simple singular reference metadata', async (t) => {
  const { client } = t.context
  // const match1 = await client.set({
  //   $id: 'maA',
  //   title: {
  //     en: 'yesh match'
  //   }
  // })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: match1
  // })

  await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    specialMatch: {
      $id: 'maA',
      title: {
        en: 'yesh match',
      },
      $edgeMeta: { isItNice: 'pretty nice', howNice: 91 },
      parents: [
        { $id: 'clA', $edgeMeta: { isItNice: 'super nice', howNice: 9001 } },
      ],
    },

    bidirMatches: [
      {
        $id: 'maA',
        $edgeMeta: { isItNice: 'kinda nice', howNice: 97 },
        parents: [
          { $id: 'clA', $edgeMeta: { isItNice: 'super nice', howNice: 9001 } },
        ],
      },
    ],
  })

  await client.set({
    $id: 'clA',
    bidirMatches: [
      {
        $id: 'maA',
        $edgeMeta: { isItNice: 'kinda nice', howNice: 97 },
      },
    ],
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMeta: {
        $field: 'specialMatch.$edgeMeta',
      },
      greatStuff: {
        isNice: {
          $field: 'specialMatch.$edgeMeta.howNice',
        },
      },
    }),
    {
      title: 'yesh club',
      specialMeta: { isItNice: 'pretty nice', howNice: 91 },
      greatStuff: {
        isNice: 91,
      },
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: {
        title: true,
        description: { $default: 'no description' },
        $edgeMeta: true,
        bidirClub: {
          title: true,
          $edgeMeta: {
            isItNice: true,
          },
        },
      },
    }),
    {
      title: 'yesh club',
      specialMatch: {
        title: 'yesh match',
        description: 'no description',
        $edgeMeta: { isItNice: 'pretty nice', howNice: 91 },
        bidirClub: {
          title: 'yesh club',
          $edgeMeta: {
            isItNice: 'kinda nice',
            // howNice: 97,
          },
        },
      },
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      parents: {
        id: true,
        $edgeMeta: true,
        $list: true,
      },
    }),
    {
      parents: [
        {
          id: 'clA',
          $edgeMeta: { isItNice: 'super nice', howNice: 9001 },
        },
      ],
    }
  )
})
