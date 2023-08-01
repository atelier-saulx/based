import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { wait } from '@saulx/utils'
import { SelvaServer } from '../../server/dist/server'
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
    languages: ['en', 'de', 'nl'],
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

test.after(async (t) => {
  await srv.destroy()
  client.destroy()
})

// TODO
test.skip('get null', async (t) => {
  await t.throwsAsync(client.get(null))
})

test.serial('get nested queries', async (t) => {
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

test.serial('get boolean value', async (t) => {
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

// TODO: setWalker update
test.serial.skip('get - root', async (t) => {
  const match = await client.set({
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
      children: [match],
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
      children: [match],
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

test.serial('get - $all simple', async (t) => {
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

test.serial('get - $all root level whitelist + $all', async (t) => {
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

test.serial('get - $all nested', async (t) => {
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

test.serial('get - $all deeply nested', async (t) => {
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

// TODO: $default
test.serial.skip('get - $default', async (t) => {
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

test.serial('get - $language', async (t) => {
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

  // TODO: $default missing
  // t.deepEqual(
  //   await client.get({
  //     $id: 'viflurx',
  //     $language: 'nl',
  //     description: { $default: 'flurpy' },
  //   }),
  //   { description: 'flurpy' }
  // )
})

test.serial('get - field with empty array', async (t) => {
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

  t.deepEqual(result, {})

  t.deepEqual(
    await client.get({
      $id: id,
      $all: true,
    }),
    {
      id,
      type: 'lekkerType',
    }
  )
})

// TODO: we should return empty arrays by default?
test.serial.skip('get - references', async (t) => {
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

  t.deepEqual(result, {
    children: [],
    descendants: [],
    refs: [id1, id11],
  })

  t.deepEqual(
    await client.get({
      $id: id2,
      $all: true,
    }),
    {
      id: id2,
      type: 'lekkerType',
      // this should no longer work (we don't return ref/refs types with $all by default
      // refs: [id1, id11],
    }
  )
})

test.serial('get - set with some items', async (t) => {
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

// TODO: `descendants: true` returns undefined, not the actual array
test.serial.skip('get - hierarchy', async (t) => {
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

  t.deepEqualIgnoreOrder(
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

// TODO: $inherit missing
test.serial.skip('get - $inherit', async (t) => {
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

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'cuD',
      title: { $inherit: { $type: ['custom', 'club'] } },
    }),
    {
      title: {
        en: 'snurf',
      },
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'cuC',
      $language: 'nl',
      title: { $inherit: { $type: ['custom', 'club'] } },
    }),
    {
      title: 'snurf',
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'cuC',
      club: {
        $inherit: { $item: 'club' },
        image: true,
        id: true,
      },
    }),
    {
      club: {
        image: { thumb: 'bla.jpg' },
        id: 'clClub',
      },
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'cuC',
      flapdrol: {
        $inherit: { $item: ['custom', 'club'] },
        image: true,
        id: true,
      },
    }),
    {
      flapdrol: {
        image: { thumb: 'flurp.jpg' },
        id: 'cuA',
      },
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'cuC',
      flapdrol: {
        $inherit: { $item: ['custom', 'club'], $required: ['image'] },
        image: true,
        id: true,
      },
    }),
    {
      flapdrol: {
        image: { thumb: 'flurp.jpg' },
        id: 'cuA',
      },
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'cuC',
      flapdrol: {
        $inherit: { $item: ['region', 'federation'] },
        image: true,
        id: true,
      },
    }),
    {
      // flapdrol: {}
    }
  )

  t.deepEqualIgnoreOrder(
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

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'cuC',
      id: true,
      flapdrol: {
        $inherit: { $item: ['custom', 'club'], $required: ['image.icon'] },
        image: true,
        id: true,
      },
    }),
    {
      id: 'cuC',
      // flapdrol: {}
    }
  )

  // FIXME: is the order really specific here?
  // t.deepEqualIgnoreOrder(
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

// TODO: $inherit missing
test.serial.skip(
  'get - $inherit with object types does shallow merge',
  async (t) => {
    const parentOfParent = await client.set({
      $id: 'vipofp',
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      ding: {
        dang: {
          dung: 9000,
          dunk: 'helloooo should not be there',
        },
        dong: ['hello', 'yesh'],
        dung: 123,
      },
    })

    const parentEntry = await client.set({
      $id: 'vip',
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      parents: {
        $add: [parentOfParent],
      },
      ding: {
        dang: {
          dung: 115,
        },
      },
    })

    const entry = await client.set({
      $id: 'vie',
      type: 'lekkerType',
      parents: {
        $add: [parentEntry],
      },
      title: {
        en: 'nice!',
      },
    })

    t.deepEqualIgnoreOrder(
      await client.get({
        $id: entry,
        id: true,
        title: { $inherit: { $merge: true } },
        ding: { $inherit: { $merge: true } },
      }),
      {
        id: entry,
        title: {
          en: 'nice!',
        },
        ding: {
          dong: ['hello', 'yesh'],
          dang: {
            dung: 115,
          },
          dung: 123,
        },
      }
    )
  }
)

// TODO: $inherit missing
test.serial.skip(
  'get - $inherit with object types shallow merge is by default disabled',
  async (t) => {
    const parentOfParent = await client.set({
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      ding: {
        dang: {
          dung: 9000,
          dunk: 'helloooo should not be there',
        },
        dong: ['hello', 'yesh'],
        dung: 123,
      },
    })

    const parentEntry = await client.set({
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      parents: {
        $add: [parentOfParent],
      },
      ding: {
        dang: {
          dung: 115,
        },
      },
    })

    const entry = await client.set({
      type: 'lekkerType',
      parents: {
        $add: [parentEntry],
      },
      title: {
        en: 'nice!',
      },
    })

    t.deepEqualIgnoreOrder(
      await client.get({
        $id: entry,
        id: true,
        title: { $inherit: { $type: 'lekkerType' } },
        ding: { $inherit: { $type: ['lekkerType'] } },
      }),
      {
        id: entry,
        title: {
          en: 'nice!',
        },
        ding: {
          dang: {
            dung: 115,
          },
        },
      }
    )
  }
)

// TODO: $inherit missing
test.serial.skip(
  'get - $inherit with object types of nested objects, does shallow merge',
  async (t) => {
    const parentOfParent = await client.set({
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      ding: {
        dang: {
          dung: 9000,
          dunk: 'yesh',
        },
        dunk: {
          ding: 9000,
          dong: 9000,
        },
        dung: 123,
      },
    })

    const parentEntry = await client.set({
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      parents: {
        $add: [parentOfParent],
      },
      ding: {
        dang: {
          dung: 115,
        },
        dunk: {
          ding: 123,
        },
      },
    })

    const entry = await client.set({
      type: 'lekkerType',
      parents: {
        $add: [parentEntry],
      },
      title: {
        en: 'nice!',
      },
      ding: {
        dung: 1,
      },
    })

    t.deepEqualIgnoreOrder(
      await client.get({
        $id: entry,
        id: true,
        title: { $inherit: { $type: 'lekkerType' } },
        ding: {
          dang: { $inherit: { $type: 'lekkerType', $merge: true } },
          dunk: { $inherit: { $type: 'lekkerType', $merge: true } },
          dung: { $inherit: { $type: 'lekkerType' } },
        },
      }),
      {
        id: entry,
        title: {
          en: 'nice!',
        },
        ding: {
          dang: {
            dung: 115,
            dunk: 'yesh',
          },
          dunk: {
            ding: 123,
            dong: 9000,
          },
          dung: 1,
        },
      }
    )
  }
)

// TODO: $alias in get
// TODO: options parse error
// › Object.backtrack (src/get/parse/opts.ts:149:25)
test.serial.skip('get - basic with many ids', async (t) => {
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
    {
      $isNull: true,
    }
  )
})

// TODO: options parse error
// › Object.backtrack (src/get/parse/opts.ts:149:25)
test.serial.skip('get - basic with non-priority language', async (t) => {
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

// TODO: querying record field returns undefined
test.serial.skip('get - record', async (t) => {
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

// TODO: querying record field returns undefined
test.serial.skip('get - text record', async (t) => {
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

// TODO: $inherit missing
test.serial.skip(
  'get - $inherit with object types does deep merge',
  async (t) => {
    const parentOfParent = await client.set({
      $id: 'vipofp',
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      ding: {
        dang: {
          dung: 9000,
          dunk: 'hello this time it should be here',
        },
        dong: ['hello', 'yesh'],
        dung: 123,
      },
    })

    const parentEntry = await client.set({
      $id: 'vip',
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      parents: {
        $add: [parentOfParent],
      },
      ding: {
        texty: { de: 'hallo' },
        dang: {
          dung: 115,
        },
        dunk: {
          dong: 1212,
        },
      },
    })

    const entry = await client.set({
      $id: 'vie',
      type: 'lekkerType',
      parents: {
        $add: [parentEntry],
      },
      title: {
        en: 'nice!',
      },
      ding: {
        texty: { en: 'hello' },
        dunk: {
          ding: 99,
        },
      },
    })

    t.deepEqualIgnoreOrder(
      await client.get({
        $id: entry,
        id: true,
        title: { $inherit: { $deepMerge: true } },
        ding: { $inherit: { $deepMerge: true } },
        // title: { $inherit: { $type: 'lekkerType', $merge: true } }, // TODO: throw, not allowed probably
        // ding: { $inherit: { $type: 'lekkerType', $merge: true } },
      }),
      {
        id: entry,
        title: {
          en: 'nice!',
        },
        ding: {
          texty: { en: 'hello' },
          dong: ['hello', 'yesh'],
          dang: {
            dung: 115,
            dunk: 'hello this time it should be here',
          },
          dung: 123,
          dunk: {
            ding: 99,
            dong: 1212,
          },
        },
      }
    )
  }
)

// TODO: $inherit missing
test.serial.skip(
  'get - $inherit with record types does deep merge',
  async (t) => {
    const parentOfParent = await client.set({
      $id: 'vipofp',
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      objRec: {
        a: {
          hello: 'not this one either',
          stringValue: 'yes string value',
        },
        b: {
          stringValue: 'inherit please',
        },
        c: {
          hello: 'yes hello from parentOfParent',
        },
        0: {
          hello: 'no',
          stringValue: 'also no',
          value: 99,
        },
      },
    })

    const parentEntry = await client.set({
      $id: 'vip',
      type: 'lekkerType',
      title: {
        en: 'nice!',
        de: 'dont want to inherit this',
      },
      parents: {
        $add: [parentOfParent],
      },
      objRec: {
        a: {
          hello: 'not this one',
          stringValue: 'this should be there',
        },
        b: {
          hello: 'yes hello from parent',
          value: 10,
        },
      },
    })

    const entry = await client.set({
      $id: 'vie',
      type: 'lekkerType',
      parents: {
        $add: [parentEntry],
      },
      title: {
        en: 'nice!',
      },
      objRec: {
        0: {
          hello: 'this is where it starts',
          stringValue: 'in the entry itself',
        },
      },
    })

    t.deepEqualIgnoreOrder(
      await client.get({
        $id: entry,
        id: true,
        title: { $inherit: { $type: 'lekkerType', $deepMerge: true } }, // TODO: throw, not allowed probably
        objRec: { $inherit: { $type: 'lekkerType', $deepMerge: true } },
        // title: { $inherit: { $type: 'lekkerType', $merge: true } }, // TODO: throw, not allowed probably
        // objRec: { $inherit: { $type: 'lekkerType', $merge: true } },
      }),
      {
        id: entry,
        title: {
          en: 'nice!',
        },
        objRec: {
          0: {
            hello: 'this is where it starts',
            stringValue: 'in the entry itself',
            value: 99,
          },
          a: {
            hello: 'not this one',
            stringValue: 'this should be there',
          },
          b: {
            hello: 'yes hello from parent',
            value: 10,
            stringValue: 'inherit please',
          },
          c: {
            hello: 'yes hello from parentOfParent',
          },
        },
      }
    )
  }
)

// TODO: querying record field returns undefined
test.serial.skip('get - record with wildcard query', async (t) => {
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

  // TODO: add a find case with both and wildcard for fields thing
})

// TODO: querying record field returns undefined
test.serial.skip('get - record with nested wildcard query', async (t) => {
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

  // TODO: add a find case with both and wildcard for fields thing
})
