import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { readValue } from 'data-record'
import './assertions'
import { SelvaTraversal } from '../src/protocol/index.js'
import { doubleDef } from '../src/protocol/encode/modify/types.js'
import getPort from 'get-port'
import { find, idExists } from './assertions/utils.js'
import { deepEqualIgnoreOrder } from './assertions/index.js'

export function readDouble(x: any) {
  return readValue(doubleDef, x, '.d')
}

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
    translations: ['nl', 'de'],
    languageFallbacks: {
      nl: ['de', 'en'],
      de: ['en'],
    },
    root: {
      fields: {
        value: { type: 'number' },
        hello: { type: 'string' },
      },
    },
    types: {
      match: {
        prefix: 'ma',
        fields: {
          value: { type: 'number' },
          title: {
            type: 'text',
          },
          obj: {
            type: 'object',
            properties: {
              hello: { type: 'string' },
              hallo: { type: 'string' },
              num: { type: 'number' },
            },
          },
          nestedObj: {
            type: 'object',
            properties: {
              a: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                },
              },
              b: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                },
              },
            },
          },
          settySet: {
            type: 'set',
            items: {
              type: 'string',
            },
          },
          reffyRefs: {
            type: 'references',
          },
          reffyRef: {
            type: 'reference',
          },
        },
      },
      league: {
        prefix: 'cu',
        fields: {
          title: {
            type: 'text',
          },
        },
      },
      person: {
        prefix: 'pe',
        fields: {
          title: {
            type: 'text',
          },
        },
      },
      someTestThing: {
        prefix: 'vi',
        fields: {
          title: {
            type: 'text',
          },
          value: {
            type: 'number',
          },
          obj: {
            type: 'object',
            properties: {
              value: { type: 'integer' },
              rec: {
                type: 'record',
                values: {
                  type: 'object',
                  properties: {
                    value: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
      otherTestThing: {
        prefix: 'ar',
        fields: {
          title: {
            type: 'text',
          },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
      lekkerType: {
        prefix: 'lk',
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
                strArray: { type: 'array', values: { type: 'string' } },
                objArray: {
                  type: 'array',
                  values: {
                    type: 'object',
                    properties: {
                      hello: { type: 'string' },
                      value: { type: 'integer' },
                    },
                  },
                },
                nestedObjArray: {
                  type: 'array',
                  values: {
                    type: 'object',
                    properties: {
                      hello: { type: 'string' },
                      value: { type: 'integer' },
                      location: {
                        type: 'object',
                        properties: {
                          lat: { type: 'number' },
                          lon: { type: 'number' },
                        },
                      },
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
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
})

test('root', async (t) => {
  const { client } = t.context
  const match = await client.set({
    type: 'match',
    value: 1,
  })

  const root = await client.set({
    $id: 'root',
    value: 9001,
    hello: 'http://example.com/hello--yo-yes',
  })

  t.deepEqual(root, 'root')
  t.deepEqual(
    (await client.command('object.get', ['', 'root', 'value']))[0],
    9001
  )

  t.deepEqual((await client.command('hierarchy.children', ['root']))[0], [
    match,
  ])

  deepEqualIgnoreOrder(
    t,
    await client.get({ $id: 'root', $all: true, schema: false }),
    {
      id: 'root',
      type: 'root',
      value: 9001,
      hello: 'http://example.com/hello--yo-yes',
    }
  )
})

test('root.children $delete: []', async (t) => {
  const { client } = t.context
  const match = await client.set({
    type: 'match',
  })

  const root = await client.set({
    $id: 'root',
    children: [match],
  })

  t.deepEqual(root, 'root')
  t.deepEqual(await client.command('hierarchy.children', ['root']), [[match]])

  // I guess empty array not allowed?
  await t.throwsAsync(
    client.set({
      $id: 'root',
      children: { $delete: [] },
    })
  )

  t.deepEqual((await client.command('hierarchy.children', ['root']))[0], [
    match,
  ])
})

test('basic', async (t) => {
  const { client } = t.context
  const match = await client.set({
    type: 'match',
    value: 1,
  })

  const league = await client.set({
    $language: 'en',
    type: 'league',
    title: 'title',
  })

  const person = await client.set({
    $language: 'en',
    type: 'person',
    parents: [match],
    title: { en: 'flurpy man' },
  })

  t.deepEqual(
    (await client.command('hierarchy.children', [match]))[0],
    [person],
    'match has correct children'
  )

  t.deepEqual(
    (await client.command('hierarchy.children', ['root']))[0].sort(),
    [league, match].sort(),
    'root has correct children'
  )

  t.deepEqual(
    (await client.command('hierarchy.children', [league]))[0],
    [],
    'league has no children'
  )

  t.is(
    (await client.command('object.get', ['', person, 'title.en']))[0],
    'flurpy man',
    'Title of person is correctly set'
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: match,
      })
    )[0],
    ['root']
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: league,
      })
    )[0],
    ['root']
  )

  // move person from match to league
  await client.set({
    $id: person,
    parents: [league],
  })

  t.deepEqual(
    (await client.command('hierarchy.children', [league]))[0],
    [person],
    'league has person after move'
  )

  t.deepEqual(
    (await client.command('hierarchy.children', [match]))[0],
    [],
    'match has no children after move'
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: person,
      })
    )[0],
    ['root', league]
  )

  // add extra parent using $add
  await client.set({
    $id: person,
    parents: {
      $add: match,
    },
  })

  t.deepEqual(
    (await client.command('hierarchy.children', [match]))[0],
    [person],
    'match has children after $add'
  )

  t.deepEqual(
    (await client.command('hierarchy.parents', [person]))[0],
    [league, match].sort(),
    'person has correct parents after $add'
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: person,
      })
    )[0],
    ['root', league, match]
  )

  // remove league from person
  await client.set({
    $id: person,
    parents: {
      $add: ['root'],
      $remove: league,
    },
  })

  t.deepEqual(
    (await client.command('hierarchy.children', [league]))[0],
    [],
    'league has no children after $remove'
  )

  t.deepEqual(
    (await client.command('hierarchy.parents', [person]))[0],
    [match, 'root'],
    'person has correct parents after $remove'
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: person,
      })
    )[0],
    ['root', match]
  )

  // add parent again
  await client.set({
    $id: person,
    parents: {
      $add: league,
    },
  })

  // double add
  await client.set({
    $id: person,
    parents: {
      $add: league,
      $remove: 'root',
    },
  })

  t.deepEqual(
    (await client.command('hierarchy.children', [match]))[0],
    [person],
    'match has children after 2nd $add'
  )

  t.deepEqual(
    (await client.command('hierarchy.parents', [person]))[0],
    [league, match].sort(),
    'person has correct parents after 2nd $add'
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: person,
      })
    )[0],
    ['root', league, match]
  )

  // reset children
  await client.set({
    $id: match,
    children: [],
  })

  t.deepEqual(
    (await client.command('hierarchy.children', [match]))[0],
    [],
    'match has no children after reset'
  )

  // add no children
  await client.set({
    $id: match,
    children: { $add: [] },
  })

  t.deepEqual(
    (await client.command('hierarchy.children', [match]))[0],
    [],
    'match has no children after $add: []'
  )

  // set null children
  await t.throwsAsync(
    client.set({
      $id: match,
      children: null,
    })
  )

  t.deepEqual(
    (await client.command('hierarchy.children', [match]))[0],
    [],
    'match has no children after children: null'
  )

  t.deepEqual(
    (await client.command('hierarchy.parents', [person]))[0],
    [league],
    'person has correct parents after reset of children of match'
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: person,
      })
    )[0],
    ['root', league]
  )

  // add person to match using children
  await client.set({
    $id: match,
    children: [person],
  })

  t.deepEqual(
    (await client.command('hierarchy.children', [match]))[0],
    [person],
    'match has children after adding person to match using children'
  )

  t.deepEqual(
    (await client.command('hierarchy.parents', [person]))[0].sort(),
    [league, match].sort(),
    'person has correct parents after adding person to match using children'
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: person,
      })
    )[0],
    ['root', league, match]
  )

  // add match to league using $add
  await client.set({
    $id: league,
    children: { $add: match },
  })

  t.deepEqual(
    (await client.command('hierarchy.parents', [match]))[0].sort(),
    ['root', league].sort(),
    'match has correct parents after adding match as a child to league'
  )

  t.deepEqual(
    (await client.command('hierarchy.children', [league]))[0].sort(),
    [match, person].sort(),
    'league has correct children after setting ancestors'
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: person,
      })
    )[0],
    ['root', league, match]
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: match,
      })
    )[0],
    ['root', league]
  )

  // delete match from league
  await client.set({
    $id: league,
    children: { $remove: match },
  })

  t.deepEqual(
    (await client.command('hierarchy.parents', [person]))[0].sort(),
    [league, match].sort(),
    'person has correct parents after removing match from league'
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: person,
      })
    )[0],
    ['root', league, match]
  )

  t.deepEqual(
    (await client.command('hierarchy.parents', [match]))[0].sort(),
    ['root'].sort(),
    'match has correct parents after removing match from league'
  )

  t.deepEqual(
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: match,
      })
    )[0],
    ['root'],
    'match has correct ancestors after removing match from league'
  )

  // delete person
  await client.delete({ $id: person })
  t.false(
    await idExists(client, person),
    'person is removed from db after delete'
  )

  // delete league
  await client.delete({ $id: league })
  t.false(
    await idExists(client, league),
    'league is removed from db after delete'
  )
})

test('deep hierarchy manipulation', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'cuX',
    children: ['cuA'],
  })

  await client.set({
    $id: 'cuA',
    children: ['cuB', 'cuC', 'cuD'],
  })

  await client.set({
    $id: 'cuE',
    parents: ['cuD'],
  })

  await client.set({
    $id: 'cuD',
    parents: { $add: 'root' },
  })

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: 'cuB',
      })
    )[0],
    ['root', 'cuX', 'cuA']
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: 'cuC',
      })
    )[0],
    ['root', 'cuX', 'cuA']
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: 'cuD',
      })
    )[0],
    ['root', 'cuX', 'cuA']
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: 'cuE',
      })
    )[0],
    ['root', 'cuX', 'cuA', 'cuD']
  )

  await client.set({
    $id: 'cuD',
    parents: { $remove: 'cuA' },
  })

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: 'cuD',
      })
    )[0],
    ['root']
  )

  deepEqualIgnoreOrder(
    t,
    (
      await find({
        client,
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
        id: 'cuE',
      })
    )[0],
    ['root', 'cuD']
  )
})

test('array, json and set', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    types: {
      flurp: {
        prefix: 'FU',
        fields: {
          flurpy: {
            type: 'json',
            // properties: {
            //   hello: {
            //     // need to check if you are already
            //     // in json or array and then you need to  strip default options etc
            //     type: 'array',
            //     items: {
            //       type: 'string',
            //     },
            //   },
            // },
          },
          flap: {
            type: 'array',
            values: {
              type: 'object',
              properties: {
                gurk: { type: 'string' },
                //flap: { type: 'digest' }
              },
            },
          },
        },
      },
    },
  })
  const id = await client.set({
    type: 'flurp',
    flap: [
      {
        gurk: 'hello',
        //flap: 'smurpy'
      },
    ],
  })
  const r = (await client.command('object.get', ['', id, 'flap']))[0]
  t.deepEqual(r, [['gurk', 'hello']])
})

test('set empty object', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    types: {
      hmmhmm: {
        prefix: 'hm',
        fields: {
          flurpy: {
            type: 'object',
            properties: {
              hello: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  })
  const id = await client.set({
    type: 'hmmhmm',
    flurpy: {},
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: id,
      flurpy: true,
    }),
    {}
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: id,
      flurpy: {
        hello: true,
      },
    }),
    {}
  )

  await client.set({
    $id: id,
    flurpy: { hello: 'yes' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: id,
      flurpy: true,
    }),
    {
      flurpy: {
        hello: 'yes',
      },
    }
  )
})

test('incrby', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viDingDong',
    value: 100,
  })

  t.is(
    (await client.command('object.get', ['', 'viDingDong', 'value']))[0],
    100
  )

  const [newVal] = await client.command('object.incrbydouble', [
    'viDingDong',
    'value',
    10,
  ])

  deepEqualIgnoreOrder(
    t,
    await client.get({ $id: 'viDingDong', value: true }),
    {
      value: 110,
    }
  )
  deepEqualIgnoreOrder(t, newVal, 110)
})

test('$increment, $default', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'viDingDong',
    value: {
      $default: 100,
      $increment: 10,
    },
  })

  t.is(
    (await client.command('object.get', ['', 'viDingDong', 'value']))[0],
    100,
    'uses default if value does not exist'
  )

  await client.set({
    $id: 'viDingDong',
    value: {
      $default: 100,
      $increment: 10,
    },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({ $id: 'viDingDong', value: true }),
    {
      value: 110,
    }
  )

  t.is(
    (await client.command('object.get', ['', 'viDingDong', 'value']))[0],
    110,
    'increment if value exists'
  )

  await client.set({
    $id: 'viDingDong',
    title: {
      en: {
        $default: 'title',
      },
    },
  })

  t.is(
    (await client.command('object.get', ['', 'viDingDong', 'title.en']))[0],
    'title',
    'set default'
  )

  await client.set({
    $id: 'viDingDong',
    title: {
      en: {
        $default: 'flurp',
      },
    },
  })

  t.is(
    // await client.redis.selva_object_get('', 'viDingDong', 'title.en'),
    (await client.command('object.get', ['', 'viDingDong', 'title.en']))[0],
    'title',
    'does not overwrite if value exists'
  )

  await client.set({
    $id: 'viHelloYes',
    obj: {
      value: {
        $default: 100,
        $increment: 10,
      },
      rec: {
        test1: {
          value: {
            $default: 10,
            $increment: 11,
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viHelloYes',
      obj: true,
    }),
    {
      obj: {
        value: 100,
        rec: {
          test1: {
            value: 10,
          },
        },
      },
    }
  )

  await client.set({
    $id: 'viHelloYes',
    obj: {
      value: {
        $default: 100,
        $increment: 10,
      },
      rec: {
        test1: {
          value: {
            $default: 11,
            $increment: 11,
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: 'viHelloYes',
      obj: true,
    }),
    {
      obj: {
        value: 110,
        rec: {
          test1: {
            value: 21,
          },
        },
      },
    }
  )
})

test('$default with string and number', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'ma1',
    value: {
      $default: 99,
    },
    obj: {
      num: {
        $default: 11,
      },
      hello: {
        $default: 'stringy string',
      },
    },
  })

  await client.set({
    $id: 'ma1',
    value: {
      $default: 10,
    },
    obj: {
      num: {
        $default: 22,
      },
      hello: {
        $default: 'stringy string',
      },
      hallo: {
        $default: 'stringy stringy string',
      },
    },
  })

  t.deepEqual(await client.get({ $id: 'ma1', value: true, obj: true }), {
    value: 99,
    obj: {
      num: 11,
      hello: 'stringy string',
      hallo: 'stringy stringy string',
    },
  })
})

test('$merge = false', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'arPower',
    title: {
      en: 'flap',
      de: 'flurpels',
    },
    image: {
      thumb: 'x',
    },
  })

  t.is(
    (await client.command('object.get', ['', 'arPower', 'title.en']))[0],
    'flap'
  )
  t.is(
    (await client.command('object.get', ['', 'arPower', 'title.de']))[0],
    'flurpels'
  )

  await client.set({
    $id: 'arPower',
    $merge: false,
    title: {
      de: 'deutschland',
    },
  })

  t.is(
    (await client.command('object.get', ['', 'arPower', 'id']))[0],
    'arPower'
  )
  t.is(
    (await client.command('object.get', ['', 'arPower', 'title.en']))[0],
    null
  )
  t.is(
    (await client.command('object.get', ['', 'arPower', 'title.de']))[0],
    'deutschland'
  )

  await client.set({
    $id: 'arPower',
    title: {
      $merge: false,
      nl: 'nl',
    },
  })

  t.is(
    (await client.command('object.get', ['', 'arPower', 'title.nl']))[0],
    'nl'
  )
  t.is(
    (await client.command('object.get', ['', 'arPower', 'title.de']))[0],
    null
  )

  await client.set({
    $id: 'arPower',
    image: {
      $merge: false,
      poster: 'x',
    },
  })

  t.is(
    (await client.command('object.get', ['', 'arPower', 'image.thumb']))[0],
    null
  )
})

test('automatic child creation', async (t) => {
  const { client } = t.context
  const childrenIds = await Promise.all(
    [
      {
        type: 'match',
        title: {
          nl: 'child1',
        },
        parents: ['viParent'],
      },
      {
        type: 'match',
        title: {
          nl: 'child2',
        },
        parents: ['viParent'],
      },
      {
        type: 'match',
        title: {
          nl: 'child3',
        },
        parents: ['viParent'],
      },
    ].map((v) => client.set(v))
  )
  const parent = await client.set({
    $id: 'viParent',
    title: {
      nl: 'nl',
    },
    children: childrenIds,
  })

  const children = (await client.command('hierarchy.children', [parent]))[0]
  t.is(children.length, 3, 'Should have 3 children created')

  const titles = (
    await Promise.all(
      children.map((child: any) => {
        // return client.redis.selva_object_get('', child, 'title.nl')
        return client.command('object.get', ['', child, 'title.nl'])
      })
    )
  ).sort()
  for (let i = 0; i < titles.length; i++) {
    t.is(titles[i][0], 'child' + (i + 1), `Child ${i} title should match`)
  }

  await client.set({
    $id: parent,
    children: {
      $add: [
        {
          $id: 'maTestId',
          title: {
            nl: 'yes with id',
          },
        },
      ],
    },
  })

  await client.set({
    $id: parent,
    children: {
      $add: [
        {
          type: 'match',
          $alias: 'maTestWithAlias',
          title: {
            nl: 'yes with alias',
          },
        },
      ],
    },
  })

  const newChildren = (await client.command('hierarchy.children', [parent]))[0]
  t.is(newChildren.length, 5, 'Should have 5 children created')
})

test('Set empty object', async (t) => {
  const { client } = t.context
  const id = await client.set({
    $id: 'maEmpty',
    nestedObj: {
      a: {},
      b: {},
    },
  })
  try {
    await client.get({
      $id: id,
      $all: true,
    })

    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('no root in parents when adding nested', async (t) => {
  const { client } = t.context
  await client.set({
    $id: 'ma1',
    $language: 'en',
    children: {
      $add: [
        {
          $alias: 'hello',
          type: 'match',
          title: 'hello1',
        },
        {
          $alias: 'hello2',
          type: 'match',
          title: 'hello2',
          parents: ['root', 'ma1'],
        },
      ],
    },
  })

  // await new Promise(res => setTimeout(res, 1e8))
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'hello',
      parents: true,
      title: true,
    }),
    {
      parents: ['ma1'],
      title: 'hello1',
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'hello2',
      parents: true,
      title: true,
    }),
    {
      parents: ['root', 'ma1'],
      title: 'hello2',
    }
  )
})

test('$delete: true', async (t) => {
  const { client } = t.context
  const match = await client.set({
    type: 'match',
    value: 1,
  })

  const root = await client.set({
    $id: 'root',
    value: 9001,
  })

  t.deepEqual(root, 'root')
  t.deepEqual(
    (await client.command('object.get', ['', 'root', 'value']))[0],
    9001
  )
  t.deepEqual((await client.command('hierarchy.children', [root]))[0], [match])

  await client.set({
    $id: 'root',
    value: { $delete: true },
  })

  t.deepEqual((await client.command('object.exists', ['root', 'value']))[0], 0n)
  t.deepEqual((await client.command('hierarchy.children', ['root']))[0], [
    match,
  ])

  await client.set({
    $id: 'maA',
    type: 'match',
    title: { en: 'yesh extra nice', de: 'ja extra nice' },
    obj: {
      hello: 'yes hello',
    },
    reffyRef: 'root',
    reffyRefs: ['root'],
    settySet: { $add: 'hmmmm' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      id: true,
      title: true,
      obj: true,
      reffyRef: true,
      reffyRefs: true,
      settySet: true,
    }),
    {
      id: 'maA',
      title: {
        en: 'yesh extra nice',
        de: 'ja extra nice',
      },
      obj: {
        hello: 'yes hello',
      },
      reffyRef: 'root',
      reffyRefs: ['root'],
      settySet: ['hmmmm'],
    }
  )

  await client.set({
    $id: 'maA',
    title: { de: { $delete: true } },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      id: true,
      title: true,
      obj: true,
      reffyRef: true,
      reffyRefs: true,
      settySet: true,
    }),
    {
      id: 'maA',
      title: {
        en: 'yesh extra nice',
      },
      obj: {
        hello: 'yes hello',
      },
      reffyRef: 'root',
      reffyRefs: ['root'],
      settySet: ['hmmmm'],
    }
  )

  await client.set({
    $id: 'maA',
    obj: { hello: { $delete: true }, hallo: 'mmmmh' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      id: true,
      title: true,
      obj: true,
      reffyRef: true,
      reffyRefs: true,
      settySet: true,
    }),
    {
      id: 'maA',
      title: {
        en: 'yesh extra nice',
      },
      obj: {
        hallo: 'mmmmh',
      },
      reffyRef: 'root',
      reffyRefs: ['root'],
      settySet: ['hmmmm'],
    }
  )

  await client.set({
    $id: 'maA',
    obj: { $delete: true },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      id: true,
      title: true,
      obj: true,
      reffyRef: true,
      reffyRefs: true,
      settySet: true,
    }),
    {
      id: 'maA',
      title: {
        en: 'yesh extra nice',
      },
      reffyRef: 'root',
      reffyRefs: ['root'],
      settySet: ['hmmmm'],
    }
  )

  await client.set({
    $id: 'maA',
    title: { $delete: true },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      id: true,
      title: true,
      obj: true,
      reffyRef: true,
      reffyRefs: true,
      settySet: true,
    }),
    {
      id: 'maA',
      reffyRef: 'root',
      reffyRefs: ['root'],
      settySet: ['hmmmm'],
    }
  )

  await client.set({
    $id: 'maA',
    reffyRef: { $delete: true },
    title: { en: 'yes title is back!!!' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      id: true,
      title: true,
      obj: true,
      reffyRef: true,
      reffyRefs: true,
      settySet: true,
    }),
    {
      id: 'maA',
      title: {
        en: 'yes title is back!!!',
      },
      reffyRefs: ['root'],
      settySet: ['hmmmm'],
    }
  )

  await client.set({
    $id: 'maA',
    reffyRefs: { $delete: true },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      id: true,
      title: true,
      obj: true,
      reffyRef: true,
      reffyRefs: true,
      settySet: true,
    }),
    {
      id: 'maA',
      title: {
        en: 'yes title is back!!!',
      },
      settySet: ['hmmmm'],
    }
  )

  await client.set({
    $id: 'maA',
    settySet: { $delete: true },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: 'maA',
      id: true,
      title: true,
      obj: true,
      reffyRef: true,
      reffyRefs: true,
      settySet: true,
    }),
    {
      id: 'maA',
      title: {
        en: 'yes title is back!!!',
      },
    }
  )
})

test('deleting an object', async (t) => {
  const { client } = t.context
  const match = await client.set({
    type: 'match',
    obj: {
      hello: 'hello',
      hallo: 'hallo',
    },
  })

  t.deepEqual(await client.get({ $id: match, obj: true }), {
    obj: {
      hello: 'hello',
      hallo: 'hallo',
    },
  })

  await client.set({
    $id: match,
    obj: { $delete: true },
  })

  t.deepEqual(await client.get({ $id: match, obj: true }), {})
})

test('setting NaN should fail', async (t) => {
  const { client } = t.context
  await t.throwsAsync(
    client.set({
      $id: 'root',
      value: NaN,
    })
  )
})

test('set - push into array', async (t) => {
  const { client } = t.context
  const id = await client.set({
    type: 'lekkerType',
    dingdongs: ['a', 'b', 'test'],
    intArray: [1, 2, 3, 4, 5],
    floatArray: [1.1, 2.2, 3.3, 4.4],
    objRec: {
      abba: {
        intArray: [1, 2, 3, 4, 5],
        floatArray: [1.1, 2.2, 3.3, 4.4],
        strArray: ['a', 'b', 'c'],
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
          },
          {
            hello: 'yes 2',
            value: 2,
          },
          {
            hello: 'yes 3',
            value: 3,
          },
        ],
        nestedObjArray: [
          {
            hello: 'yes 1',
            value: 1,
            location: {
              lat: 1,
              lon: 1,
            },
          },
          {
            hello: 'yes 2',
            value: 2,
            location: {
              lat: 2,
              lon: 2,
            },
          },
          {
            hello: 'yes 3',
            value: 3,
            location: {
              lat: 3,
              lon: 3,
            },
          },
        ],
      },
    },
  })

  await client.set({
    $id: id,
    objRec: {
      abba: {
        intArray: {
          $push: 7,
        },
      },
    },
  })

  await client.set({
    $id: id,
    objRec: {
      abba: {
        floatArray: {
          $push: 7.275,
        },
      },
    },
  })

  await client.set({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $push: {
            hello: 'yes 7',
            value: 7,
          },
        },
        nestedObjArray: {
          $push: {
            hello: 'yes 7',
            value: 7,
            location: {
              lat: 7,
              lon: 7,
            },
          },
        },
      },
    },
  })

  await client.set({
    $id: id,
    objRec: {
      abba: {
        strArray: {
          $push: 'abba',
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          intArray: [1, 2, 3, 4, 5, 7],
          floatArray: [1.1, 2.2, 3.3, 4.4, 7.275],
          strArray: ['a', 'b', 'c', 'abba'],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
            {
              hello: 'yes 7',
              value: 7,
            },
          ],
          nestedObjArray: [
            {
              hello: 'yes 1',
              value: 1,
              location: {
                lat: 1,
                lon: 1,
              },
            },
            {
              hello: 'yes 2',
              value: 2,
              location: {
                lat: 2,
                lon: 2,
              },
            },
            {
              hello: 'yes 3',
              value: 3,
              location: {
                lat: 3,
                lon: 3,
              },
            },
            {
              hello: 'yes 7',
              value: 7,
              location: {
                lat: 7,
                lon: 7,
              },
            },
          ],
        },
      },
    }
  )
})

test('set - assign into array', async (t) => {
  const { client } = t.context
  const id = await client.set({
    type: 'lekkerType',
    dingdongs: ['a', 'b', 'test'],
    intArray: [1, 2, 3, 4, 5],
    floatArray: [1.1, 2.2, 3.3, 4.4],
    objRec: {
      abba: {
        intArray: [1, 2, 3, 4, 5],
        floatArray: [1.1, 2.2, 3.3, 4.4],
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
          },
          {
            hello: 'yes 2',
            value: 2,
          },
          {
            hello: 'yes 3',
            value: 3,
          },
        ],
      },
    },
  })

  await client.set({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $assign: {
            $idx: 0,
            $value: {
              value: 7,
            },
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          intArray: [1, 2, 3, 4, 5],
          floatArray: [1.1, 2.2, 3.3, 4.4],
          objArray: [
            {
              hello: 'yes 1',
              value: 7,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $assign: {
            $idx: 3,
            $value: {
              hello: 'yes 11',
              value: 11,
            },
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          intArray: [1, 2, 3, 4, 5],
          floatArray: [1.1, 2.2, 3.3, 4.4],
          objArray: [
            {
              hello: 'yes 1',
              value: 7,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
            {
              hello: 'yes 11',
              value: 11,
            },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $assign: {
            $idx: 1,
            $value: {
              hello: 'yes 0',
              value: 0,
            },
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          intArray: [1, 2, 3, 4, 5],
          floatArray: [1.1, 2.2, 3.3, 4.4],
          objArray: [
            {
              hello: 'yes 1',
              value: 7,
            },
            {
              hello: 'yes 0',
              value: 0,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
            {
              hello: 'yes 11',
              value: 11,
            },
          ],
        },
      },
    }
  )
})

test('set - remove from array', async (t) => {
  const { client } = t.context
  const id = await client.set({
    type: 'lekkerType',
    dingdongs: ['a', 'b', 'test'],
    intArray: [1, 2, 3, 4, 5],
    floatArray: [1.1, 2.2, 3.3, 4.4],
    objRec: {
      abba: {
        intArray: [1, 2, 3, 4, 5],
        floatArray: [1.1, 2.2, 3.3, 4.4],
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
          },
          {
            hello: 'yes 2',
            value: 2,
          },
          {
            hello: 'yes 3',
            value: 3,
          },
        ],
      },
    },
  })

  await client.set({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $remove: {
            $idx: 1,
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          intArray: [1, 2, 3, 4, 5],
          floatArray: [1.1, 2.2, 3.3, 4.4],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $remove: {
            $idx: 0,
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          intArray: [1, 2, 3, 4, 5],
          floatArray: [1.1, 2.2, 3.3, 4.4],
          objArray: [
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )
})

test('set - insert into array', async (t) => {
  const { client } = t.context
  const id = await client.set({
    type: 'lekkerType',
    dingdongs: ['a', 'b', 'test'],
    intArray: [1, 2, 3, 4, 5],
    floatArray: [1.1, 2.2, 3.3, 4.4],
    objRec: {
      abba: {
        intArray: [1, 2, 3, 4, 5],
        floatArray: [1.1, 2.2, 3.3, 4.4],
        strArray: ['a', 'b', 'c'],
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
          },
          {
            hello: 'yes 2',
            value: 2,
          },
          {
            hello: 'yes 3',
            value: 3,
          },
        ],
      },
    },
  })

  await client.set({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $insert: {
            $idx: 0,
            $value: {
              value: 7,
            },
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          intArray: [1, 2, 3, 4, 5],
          floatArray: [1.1, 2.2, 3.3, 4.4],
          strArray: ['a', 'b', 'c'],
          objArray: [
            { value: 7 },
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        strArray: {
          $insert: {
            $idx: 2,
            $value: 'abba',
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4],
          intArray: [1, 2, 3, 4, 5],
          strArray: ['a', 'b', 'abba', 'c'],
          objArray: [
            { value: 7 },
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        intArray: {
          $insert: {
            $idx: 1,
            $value: 11,
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4],
          intArray: [1, 11, 2, 3, 4, 5],
          strArray: ['a', 'b', 'abba', 'c'],
          objArray: [
            { value: 7 },
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )
})

test('set - insert and set further into array', async (t) => {
  const { client } = t.context
  const id = await client.set({
    type: 'lekkerType',
    dingdongs: ['a', 'b', 'test'],
    intArray: [1, 2, 3, 4, 5],
    floatArray: [1.1, 2.2, 3.3, 4.4],
    objRec: {
      abba: {
        intArray: [1, 2, 3, 4, 5],
        floatArray: [1.1, 2.2, 3.3, 4.4],
        strArray: ['a', 'b', 'c'],
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
          },
          {
            hello: 'yes 2',
            value: 2,
          },
          {
            hello: 'yes 3',
            value: 3,
          },
        ],
      },
    },
  })

  await client.set({
    $id: id,
    objRec: {
      abba: {
        objArray: {
          $assign: {
            $idx: 5,
            $value: {
              value: 7,
            },
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4],
          intArray: [1, 2, 3, 4, 5],
          strArray: ['a', 'b', 'c'],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
            {},
            {},
            { value: 7 },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        intArray: {
          $insert: {
            $idx: 6,
            $value: 7,
          },
        },
        floatArray: {
          $insert: {
            $idx: 6,
            $value: 7.7,
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4, 0, 0, 7.7],
          intArray: [1, 2, 3, 4, 5, 0, 7],
          strArray: ['a', 'b', 'c'],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
            {},
            {},
            { value: 7 },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        intArray: {
          $insert: {
            $idx: 2,
            $value: [123, 124, 125],
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4, 0, 0, 7.7],
          intArray: [1, 2, 123, 124, 125, 3, 4, 5, 0, 7],
          strArray: ['a', 'b', 'c'],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
            {},
            {},
            { value: 7 },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        intArray: {
          $push: [11, 12, 13],
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4, 0, 0, 7.7],
          intArray: [1, 2, 123, 124, 125, 3, 4, 5, 0, 7, 11, 12, 13],
          strArray: ['a', 'b', 'c'],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
            {},
            {},
            { value: 7 },
          ],
        },
      },
    }
  )
})

test('set - insert and set into start of array', async (t) => {
  const { client } = t.context
  const id = await client.set({
    type: 'lekkerType',
    dingdongs: ['a', 'b', 'test'],
    intArray: [1, 2, 3, 4, 5],
    floatArray: [1.1, 2.2, 3.3, 4.4],
    objRec: {
      abba: {
        intArray: [1, 2, 3, 4, 5],
        floatArray: [1.1, 2.2, 3.3, 4.4],
        strArray: ['a', 'b', 'c'],
        objArray: [
          {
            hello: 'yes 1',
            value: 1,
          },
          {
            hello: 'yes 2',
            value: 2,
          },
          {
            hello: 'yes 3',
            value: 3,
          },
        ],
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4],
          intArray: [1, 2, 3, 4, 5],
          strArray: ['a', 'b', 'c'],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        intArray: {
          $unshift: [11, 12, 13],
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4],
          intArray: [11, 12, 13, 1, 2, 3, 4, 5],
          strArray: ['a', 'b', 'c'],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        intArray: {
          $unshift: {
            $value: [-11, -12, -13],
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4],
          intArray: [-11, -12, -13, 11, 12, 13, 1, 2, 3, 4, 5],
          strArray: ['a', 'b', 'c'],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )

  await client.set({
    $id: id,
    objRec: {
      abba: {
        intArray: {
          $unshift: {
            $value: 123,
          },
        },
      },
    },
  })

  t.deepEqual(
    await client.get({
      $id: id,
      objRec: true,
    }),
    {
      objRec: {
        abba: {
          floatArray: [1.1, 2.2, 3.3, 4.4],
          intArray: [123, -11, -12, -13, 11, 12, 13, 1, 2, 3, 4, 5],
          strArray: ['a', 'b', 'c'],
          objArray: [
            {
              hello: 'yes 1',
              value: 1,
            },
            {
              hello: 'yes 2',
              value: 2,
            },
            {
              hello: 'yes 3',
              value: 3,
            },
          ],
        },
      },
    }
  )
})
