import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
import './assertions/index.js'
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
    translations: ['de', 'nl'],
    languageFallbacks: {
      en: ['de'],
      nl: ['de', 'en'],
    },
    root: {
      fields: {
        value: { type: 'number' },
        nested: {
          type: 'object',
          properties: {
            fun: { type: 'string' },
          },
        },
      },
    },
    types: {
      lekkerType: {
        prefix: 'vi',
        fields: {
          strRec: {
            type: 'record',
            values: {
              type: 'string',
            },
          },
          textRec: {
            type: 'record',
            values: {
              type: 'text',
            },
          },
          objRec: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                floatArray: { type: 'array', values: { type: 'number' } },
                intArray: { type: 'array', values: { type: 'integer' } },
                objArray: {
                  type: 'array',
                  values: {
                    type: 'object',
                    properties: {
                      hello: { type: 'string' },
                      value: { type: 'integer' },
                      fvalue: { type: 'number' },
                    },
                  },
                },
                hello: {
                  type: 'string',
                },
                nestedRec: {
                  type: 'record',
                  values: {
                    type: 'object',
                    properties: {
                      value: {
                        type: 'number',
                      },
                      hello: {
                        type: 'string',
                      },
                    },
                  },
                },
                value: {
                  type: 'number',
                },
                stringValue: {
                  type: 'string',
                },
              },
            },
          },
          thing: { type: 'set', items: { type: 'string' } },
          ding: {
            type: 'object',
            properties: {
              dong: { type: 'set', items: { type: 'string' } },
              texty: { type: 'text' },
              dung: { type: 'number' },
              dang: {
                type: 'object',
                properties: {
                  dung: { type: 'number' },
                  dunk: { type: 'string' },
                },
              },
              dunk: {
                type: 'object',
                properties: {
                  ding: { type: 'number' },
                  dong: { type: 'number' },
                },
              },
            },
          },
          dong: { type: 'json' },
          dingdongs: { type: 'array', values: { type: 'string' } },
          floatArray: { type: 'array', values: { type: 'number' } },
          intArray: { type: 'array', values: { type: 'integer' } },
          tsArray: { type: 'array', values: { type: 'timestamp' } },
          refs: { type: 'references' },
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
      custom: {
        prefix: 'cu',
        fields: {
          name: { type: 'string' },
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
      club: {
        prefix: 'cl',
        fields: {
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
          title: { type: 'text' },
          value: { type: 'number' },
          description: { type: 'text' },
        },
      },
      yesno: {
        prefix: 'yn',
        fields: {
          bolYes: { type: 'boolean' },
          bolNo: { type: 'boolean' },
        },
      },
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
  await wait(300)
})

test('get null', async (t) => {
  const { client } = t.context
  await t.throwsAsync(client.get(null))
})

test('get nested queries', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maTest',
    value: 11,
    title: { en: 'hello' },
  })

  await client.set({
    $id: 'maTest2',
    value: 12,
    title: { en: 'halloumi' },
  })

  t.deepEqual(
    await client.get({
      $id: 'maTest',
      id: true,
      someItem: {
        $id: 'maTest2',
        title: true,
        nestedThing: { $id: 'maTest', value: true },
      },
      values: [
        {
          $id: 'maTest',
          id: true,
          value: true,
        },
        {
          $id: 'maTest2',
          id: true,
          value: true,
        },
      ],
      title: true,
    }),
    {
      id: 'maTest',
      title: { en: 'hello' },
      someItem: {
        title: {
          en: 'halloumi',
        },
        nestedThing: {
          value: 11,
        },
      },
      values: [
        {
          id: 'maTest',
          value: 11,
        },
        {
          id: 'maTest2',
          value: 12,
        },
      ],
    }
  )
})

test('get boolean value', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'ynTest',
    bolYes: true,
    bolNo: false,
  })

  t.deepEqual(
    await client.get({
      $id: 'ynTest',
      id: true,
      bolYes: true,
      bolNo: true,
    }),
    {
      id: 'ynTest',
      bolYes: true,
      bolNo: false,
    }
  )
})

test('get - root', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maTest',
    value: 11,
  })

  await client.set({
    $id: 'root',
    value: 2555,
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      id: true,
      value: true,
      children: true,
    }),
    {
      id: 'root',
      value: 2555,
      children: ['maTest'],
    }
  )

  t.deepEqual(
    await client.get({
      id: true,
      value: true,
      children: true,
    }),
    {
      id: 'root',
      value: 2555,
      children: ['maTest'],
    }
  )

  await client.set({
    $id: 'root',
    nested: { fun: 'yes fun' },
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      id: true,
      nested: { $all: true },
    }),
    {
      id: 'root',
      nested: { fun: 'yes fun' },
    }
  )
})

test('get - $all simple', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maA',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
  })

  const res = await client.get({
    $id: 'maA',
    $all: true,
    aliases: false,
  })
  delete res.createdAt
  delete res.updatedAt
  t.deepEqual(res, {
    id: 'maA',
    type: 'match',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
  })
})

test('get - $all root level whitelist + $all', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'clA',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
    image: {
      thumb: 'thumb',
      poster: 'poster',
    },
  })

  const res = await client.get({
    $id: 'clA',
    image: {
      thumb: true,
    },
    $all: true,
    aliases: false,
  })
  delete res.createdAt
  delete res.updatedAt
  t.deepEqual(res, {
    id: 'clA',
    type: 'club',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
    image: {
      thumb: 'thumb',
    },
  })
})

test('get - $all nested', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'maA',
    title: {
      en: 'nice!',
    },
    description: {
      en: 'yesh',
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'maA',
      id: true,
      title: {
        $all: true,
      },
      description: {
        $all: true,
      },
    }),
    {
      id: 'maA',
      title: {
        en: 'nice!',
      },
      description: {
        en: 'yesh',
      },
    }
  )
})

test('get - $all deeply nested', async (t) => {
  const { client } = t.context
  const entry = await client.set({
    type: 'lekkerType',
    title: {
      en: 'nice!',
    },
    ding: {
      dang: {
        dung: 115,
        dunk: '',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: entry,
      id: true,
      title: {
        en: true,
      },
      ding: { $all: true },
    }),
    {
      id: entry,
      title: {
        en: 'nice!',
      },
      ding: {
        dang: {
          dung: 115,
          dunk: '',
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: entry,
      id: true,
      title: {
        en: true,
      },
      ding: { dang: { $all: true } },
    }),
    {
      id: entry,
      title: {
        en: 'nice!',
      },
      ding: {
        dang: {
          dung: 115,
          dunk: '',
        },
      },
    }
  )
})

test('get - $default', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viflap',
    title: { en: 'flap' },
  })

  t.deepEqual(
    await client.get({
      $id: 'viflap',
      age: { $default: 100 },
    }),
    { age: 100 }
  )

  t.deepEqual(
    await client.get({
      $id: 'viflap',
      title: {
        en: { $default: 'untitled' },
        nl: { $default: 'naamloos' },
      },
    }),
    {
      title: { en: 'flap', nl: 'naamloos' },
    }
  )
})

test('get - $language', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viflap',
    title: { en: 'flap', nl: 'flurp' },
    description: { en: 'yes', nl: 'ja' },
  })

  t.deepEqual(
    await client.get({
      $id: 'viflap',
      title: true,
      description: true,
      $language: 'nl',
    }),
    {
      title: 'flurp',
      description: 'ja',
    }
  )

  await client.set({
    $id: 'viflurx',
    title: { en: 'flap', nl: 'flurp' },
  })

  t.deepEqual(
    await client.get({
      $id: 'viflurx',
      $language: 'nl',
      description: { $default: 'flurpy' },
    }),
    { description: 'flurpy' }
  )
})

test('get - field with empty array', async (t) => {
  const { client } = t.context
  const id = await client.set({
    type: 'lekkerType',
    thing: [],
    dong: { dingdong: [] },
    ding: { dong: [] },
    dingdongs: [],
    refs: [],
  })

  const result = await client.get({
    $id: id,
    thing: true,
    dong: true,
    ding: { dong: true },
    dingdongs: true,
    children: true,
    descendants: true,
    refs: true,
  })

  t.deepEqual(result, {
    dong: { dingdong: [] },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      $all: true,
      updatedAt: false,
      createdAt: false,
    }),
    {
      id,
      dong: { dingdong: [] },
      type: 'lekkerType',
    }
  )
})

test('get - references', async (t) => {
  const { client } = t.context
  const id1 = await client.set({
    type: 'lekkerType',
    value: 1,
  })
  const id11 = await client.set({
    type: 'lekkerType',
    value: 11,
  })
  const id2 = await client.set({
    type: 'lekkerType',
    refs: [id1, id11],
    value: 2,
  })

  const result = await client.get({
    $id: id2,
    children: true,
    descendants: true,
    refs: true,
  })

  deepEqualIgnoreOrder(t, result, {
    refs: [id1, id11],
  })

  t.deepEqual(
    await client.get({
      $id: id2,
      $all: true,
      updatedAt: false,
      createdAt: false,
    }),
    {
      id: id2,
      type: 'lekkerType',
      value: 2,
    }
  )
})

test('get - set with some items', async (t) => {
  const { client } = t.context
  const id = await client.set({
    type: 'lekkerType',
    thing: ['a', 'b'],
  })

  const result = await client.get({
    $id: id,
    thing: true,
  })

  t.deepEqual(result, {
    thing: ['a', 'b'],
  })
})

test('get - hierarchy', async (t) => {
  const { client } = t.context
  await Promise.all([
    await client.set({
      $id: 'viflo',
      value: 1,
    }),
    await client.set({
      $id: 'maflux',
      value: 2,
    }),
  ])
  await client.set({
    $id: 'vifla',
    children: ['viflo', 'maflux'],
  })
  await client.set({
    $id: 'viflapx',
    children: ['vifla', 'viflo'],
  })

  console.dir(
    {
      result: await client.get({
        $id: 'viflapx',
        descendants: true,
        children: true,
        parents: true,
      }),
    },
    { depth: 6 }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'viflapx',
      descendants: true,
      children: true,
      parents: true,
    }),
    {
      descendants: ['viflo', 'vifla', 'maflux'],
      children: ['viflo', 'vifla'],
      parents: ['root'],
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'maflux',
      ancestors: true,
    }),
    {
      ancestors: ['root', 'vifla', 'viflapx'],
    }
  )
})

test('get - $inherit', async (t) => {
  const { client } = t.context
  /*
    root
      |_ cuX
          |_cuC
      |_cuA
          |_cuC
          |_cuB
              |_cuD <---
                |_cuC

      |_cuFlap
        |_cuFlurp
          |_cuD <---


      |_clClub
        |_cuB
      |_cuDfp
        |_cuD
      |_cuMrsnurfels
        |_cuD


      root
      |_ leA
          |_seasonA
             |_matchA
             |_teamA //ignoe ancestor from cut of point outside of my hierarchy
                |_matchA

      |_ leB
          |_seasonB
             |_teamA
                |_matchA

  */

  // close ancestors [ cuMrsnurfels, cuDfp, cuB, clClub, root ]

  // close ancestors of cuD
  // dfp, cub, cuD

  await Promise.all([
    client.set({
      $id: 'cuA',
      image: {
        thumb: 'flurp.jpg',
      },
      title: { en: 'snurf' },
      children: ['cuB', 'cuC'],
    }),
    client.set({
      $id: 'cuB',
      children: ['cuC', 'cuD'],
    }),
    client.set({
      $id: 'cuX',
      children: ['cuC'],
    }),
    client.set({
      $id: 'clClub',
      image: {
        thumb: 'bla.jpg',
      },
      children: ['cuB'],
    }),
    client.set({
      $id: 'cuDfp',
      name: 'dfp',
      image: {
        thumb: 'dfp.jpg',
      },
      children: ['cuD'],
    }),
    client.set({
      $id: 'cuMrsnur',
      name: 'MrSnurfels',
      image: {
        thumb: 'snurfels.jpg',
      },
      children: ['cuD'],
    }),
  ])

  const r = await client.get({
    $id: 'cuD',
    title: { $inherit: { $type: ['custom', 'club'] } },
  })
  t.log({ r })
  deepEqualIgnoreOrder(t, r, {
    title: {
      en: 'snurf',
    },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'cuC',
      $language: 'nl',
      title: { $inherit: { $type: ['custom', 'club'] } },
    }),
    {
      title: 'snurf',
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'cuC',
      image: {
        $inherit: { $type: ['custom', 'club'] },
      },
    }),
    {
      image: { thumb: 'flurp.jpg' },
    }
  )

  // FIXME: is the order really specific here?
  // deepEqualIgnoreOrder(t,
  //   await client.get({
  //     $id: 'cuD',
  //     image: {
  //       $inherit: { $name: ['dfp', 'MrSnurfels'] }
  //     }
  //   }),
  //   {
  //     image: { thumb: 'dfp.jpg' }
  //   }
  // )
})

test('get - basic with many ids', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viA',
    title: {
      en: 'nice!',
    },
    value: 25,
    auth: {
      // role needs to be different , different roles per scope should be possible
      role: {
        id: ['root'],
        type: 'admin',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $alias: ['viZ', 'viA'],
      id: true,
      title: true,
      value: true,
    }),
    {
      id: 'viA',
      title: { en: 'nice!' },
      value: 25,
    }
  )

  t.deepEqual(
    await client.get({
      $alias: ['viA', 'viZ'],
      value: true,
    }),
    {
      value: 25,
    }
  )

  t.deepEqual(
    await client.get({
      $alias: ['abba', 'viA'],
      value: true,
    }),
    {
      value: 25,
    }
  )

  await client.set({
    $id: 'viA',
    aliases: { $add: 'abba' },
  })

  t.deepEqual(
    await client.get({
      $alias: ['abba', 'viZ'],
      value: true,
    }),
    {
      value: 25,
    }
  )

  t.deepEqual(
    await client.get({
      $alias: ['viZ', 'viY'],
      $language: 'en',
      id: true,
      title: true,
    }),
    {}
  )
})

test('get - basic with non-priority language', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viA',
    title: {
      de: 'nice de!',
    },
    value: 25,
    auth: {
      // role needs to be different , different roles per scope should be possible
      role: {
        id: ['root'],
        type: 'admin',
      },
    },
  })

  t.deepEqual(
    await client.get({
      $language: 'en',
      $alias: ['viZ', 'viA'],
      id: true,
      title: true,
      value: true,
    }),
    {
      id: 'viA',
      title: 'nice de!',
      value: 25,
    }
  )

  t.deepEqual(
    await client.get({
      $language: 'nl',
      $alias: ['viZ', 'viA'],
      id: true,
      title: true,
      value: true,
    }),
    {
      id: 'viA',
      title: 'nice de!',
      value: 25,
    }
  )

  await client.set({
    $id: 'viA',
    title: {
      nl: 'nice nl!',
    },
  })

  t.deepEqual(
    await client.get({
      $language: 'en',
      $alias: ['viZ', 'viA'],
      id: true,
      title: true,
      value: true,
    }),
    {
      id: 'viA',
      title: 'nice de!',
      value: 25,
    }
  )

  t.deepEqual(
    await client.get({
      $language: 'nl',
      $alias: ['viZ', 'viA'],
      id: true,
      title: true,
      value: true,
    }),
    {
      id: 'viA',
      title: 'nice nl!',
      value: 25,
    }
  )
})

test('get - record', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viA',
    title: {
      en: 'nice!',
    },
    strRec: {
      hello: 'hallo',
      world: 'hmm',
    },
    objRec: {
      myObj1: {
        hello: 'pff',
        value: 12,
      },
      obj2: {
        hello: 'ffp',
        value: 12,
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      strRec: true,
    }),
    {
      id: 'viA',
      title: 'nice!',
      strRec: {
        hello: 'hallo',
        world: 'hmm',
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      strRec: {
        world: true,
      },
    }),
    {
      id: 'viA',
      title: 'nice!',
      strRec: {
        world: 'hmm',
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      objRec: true,
    }),
    {
      id: 'viA',
      title: 'nice!',
      objRec: {
        myObj1: {
          hello: 'pff',
          value: 12,
        },
        obj2: {
          hello: 'ffp',
          value: 12,
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      objRec: {
        myObj1: {
          value: true,
        },
        obj2: {
          hello: true,
        },
      },
    }),
    {
      id: 'viA',
      title: 'nice!',
      objRec: {
        myObj1: {
          value: 12,
        },
        obj2: {
          hello: 'ffp',
        },
      },
    }
  )
})

test('get - text record', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viA',
    title: {
      en: 'nice!',
    },
    textRec: {
      hello: { en: 'hallo' },
      world: { en: 'hmm' },
    },
  })

  await client.set({
    $id: 'viB',
    title: {
      en: 'nice!',
    },
    textRec: {
      yes: { en: 'yes have it' },
    },
  })

  await client.set({
    $id: 'viC',
    title: {
      en: 'nice!',
    },
    parents: ['viB'],
  })

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      textRec: true,
    }),
    {
      id: 'viA',
      title: 'nice!',
      textRec: {
        hello: 'hallo',
        world: 'hmm',
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      textRec: {
        world: true,
      },
    }),
    {
      id: 'viA',
      title: 'nice!',
      textRec: {
        world: 'hmm',
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'viC',
      $language: 'en',
      id: true,
      title: true,
      textRec: {
        $inherit: true,
      },
    }),
    {
      id: 'viC',
      title: 'nice!',
      textRec: {
        yes: 'yes have it',
      },
    }
  )
})

test('get - record with wildcard query', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viA',
    title: {
      en: 'nice!',
    },
    objRec: {
      myObj1: {
        hello: 'pff',
        value: 12,
      },
      obj2: {
        hello: 'ffp',
        value: 13,
      },
    },
  })

  await client.set({
    $id: 'viB',
    title: {
      en: 'nice!!!',
    },
    objRec: {
      myObj1: {
        hello: 'hmm',
        value: 22,
      },
      obj2: {
        hello: 'mmh',
        value: 23,
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      objRec: {
        '*': {
          hello: true,
        },
      },
    }),
    {
      id: 'viA',
      title: 'nice!',
      objRec: {
        myObj1: {
          hello: 'pff',
        },
        obj2: {
          hello: 'ffp',
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      objRec: {
        '*': {
          value: true,
        },
      },
    }),
    {
      id: 'viA',
      title: 'nice!',
      objRec: {
        myObj1: {
          value: 12,
        },
        obj2: {
          value: 13,
        },
      },
    }
  )
})

test('get - record with nested wildcard query', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viA',
    title: {
      en: 'nice!',
    },
    objRec: {
      myObj1: {
        hello: 'pff',
        value: 12,
        nestedRec: {
          thing1: {
            hello: 'pff',
            value: 12,
          },
          thing2: {
            hello: 'ffp',
            value: 13,
          },
        },
      },
      obj2: {
        hello: 'ffp',
        value: 13,
        nestedRec: {
          thing3: {
            hello: 'pff',
            value: 12,
          },
          thing4: {
            hello: 'ffp',
            value: 13,
          },
        },
      },
    },
  })

  await client.set({
    $id: 'viB',
    title: {
      en: 'nice!!!',
    },
    objRec: {
      myObj1: {
        hello: 'hmm',
        value: 22,
      },
      obj2: {
        hello: 'mmh',
        value: 23,
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      objRec: {
        '*': {
          nestedRec: {
            '*': {
              hello: true,
            },
          },
        },
      },
    }),
    {
      id: 'viA',
      title: 'nice!',
      objRec: {
        myObj1: {
          nestedRec: {
            thing1: {
              hello: 'pff',
            },
            thing2: {
              hello: 'ffp',
            },
          },
        },
        obj2: {
          nestedRec: {
            thing3: {
              hello: 'pff',
            },
            thing4: {
              hello: 'ffp',
            },
          },
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'viA',
      $language: 'en',
      id: true,
      title: true,
      objRec: {
        '*': {
          nestedRec: {
            '*': {
              value: true,
            },
          },
        },
      },
    }),
    {
      id: 'viA',
      title: 'nice!',
      objRec: {
        myObj1: {
          nestedRec: {
            thing1: {
              value: 12,
            },
            thing2: {
              value: 13,
            },
          },
        },
        obj2: {
          nestedRec: {
            thing3: {
              value: 12,
            },
            thing4: {
              value: 13,
            },
          },
        },
      },
    }
  )
})
