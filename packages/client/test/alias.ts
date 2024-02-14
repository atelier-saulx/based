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
    types: {
      lekkerType: {
        prefix: 'vi',
        fields: {
          thing: { type: 'set', items: { type: 'string' } },
          ding: {
            type: 'object',
            properties: {
              dong: { type: 'set', items: { type: 'string' } },
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
          dingdongs: { type: 'array', items: { type: 'string' } },
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
          description: { type: 'text' },
        },
      },
    },
  })
})

test.afterEach.always(async (t) => {
  const { srv, client } = t.context
  await srv.destroy()
  client.destroy()
  await wait(500)
})

test('get non-existing by $alias', async (t) => {
  const { client } = t.context
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'does_not_exists',
      id: true,
      title: true,
      aliases: true,
    }),
    {}
  )
})

test('set alias and get by $alias', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    aliases: ['nice_match'],
    type: 'match',
    title: { en: 'yesh' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'nice_match',
      id: true,
      title: true,
      aliases: true,
    }),
    {
      id: match1,
      title: 'yesh',
      aliases: ['nice_match'],
    }
  )

  const match2 = await client.set({
    aliases: ['nice_match', 'very_nice_match'],
    type: 'match',
    title: { en: 'yesh2' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'nice_match',
      id: true,
      title: true,
      aliases: true,
    }),
    {
      id: match2,
      title: 'yesh2',
      aliases: ['nice_match', 'very_nice_match'],
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'very_nice_match',
      id: true,
      title: true,
    }),
    {
      id: match2,
      title: 'yesh2',
    }
  )

  await client.set({
    $id: match1,
    aliases: { $add: ['ok_match'] },
  })

  await client.set({
    $id: match2,
    aliases: { $remove: ['very_nice_match'] },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'nice_match',
      id: true,
      title: true,
      aliases: true,
    }),
    {
      id: match2,
      title: 'yesh2',
      aliases: ['nice_match'],
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'ok_match',
      id: true,
      title: true,
      aliases: true,
    }),
    {
      id: match1,
      title: 'yesh',
      aliases: ['ok_match'],
    }
  )
})

test('set new entry with alias', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    $alias: 'nice_match',
    type: 'match',
    title: { en: 'yesh' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'nice_match',
      id: true,
      title: true,
      aliases: true,
    }),
    {
      id: match1,
      title: 'yesh',
      aliases: ['nice_match'],
    }
  )
})

test('set existing entry with alias', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    $alias: 'nice_match',
    type: 'match',
    title: { en: 'yesh' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'nice_match',
      id: true,
      title: true,
      aliases: true,
    }),
    {
      id: match1,
      title: 'yesh',
      aliases: ['nice_match'],
    }
  )

  await client.set({
    $alias: ['not_so_nice_match', 'nice_match'], // second one exists
    type: 'match',
    title: { en: 'yesh yesh' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'nice_match',
      id: true,
      title: true,
      aliases: true,
    }),
    {
      id: match1,
      title: 'yesh yesh',
      aliases: ['nice_match'],
    }
  )

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'nice_match',
      id: true,
      title: true,
      aliases: true,
    }),
    {
      id: match1,
      title: 'yesh yesh',
      aliases: ['nice_match'],
    }
  )
})

test('set and get by $alias as id', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    type: 'match',
    title: { en: 'yesh' },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: match1,
      id: true,
      title: true,
    }),
    {
      id: match1,
      title: 'yesh',
    }
  )
})

test('set parent by alias', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    type: 'match',
    title: { en: 'yesh' },
    aliases: {
      $add: 'match-1',
    },
  })

  const matchX = await client.set({
    type: 'match',
    title: { en: 'yeshX' },
  })

  const match2 = await client.set({
    type: 'match',
    title: { en: 'yesh-yesh' },
    parents: {
      $add: [
        {
          $alias: 'match-1',
          type: 'match',
        },
        {
          $id: matchX,
        },
        {
          $alias: 'non-existent',
          type: 'match',
        },
      ],
    },
  })

  const stub = await client.get({
    $alias: 'non-existent',
    id: true,
    parents: true,
  })

  deepEqualIgnoreOrder(t, stub.parents, undefined)

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $id: match2,
      title: true,
      parents: true,
    }),
    {
      title: 'yesh-yesh',
      parents: [match1, matchX, stub.id, 'root'],
    }
  )
})

test('set parent by alias 2', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    type: 'match',
    title: { en: 'yesh' },
    aliases: ['snurk'],
  })

  const result = await client.get({
    $id: 'root',
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

  console.dir(result, { depth: null })

  await client.set({
    type: 'custom',
    parents: { $add: [{ $id: match1 }] },
  })

  const result2 = await client.get({
    $id: 'root',
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

  deepEqualIgnoreOrder(t, result2.items, [{ id: match1 }])
})

test('delete all aliases of a node', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    type: 'match',
    title: { en: 'yesh' },
    aliases: { $add: ['nice_match', 'nicer_match'] },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $alias: 'nice_match',
      id: true,
      aliases: true,
    }),
    {
      id: match1,
      aliases: ['nice_match', 'nicer_match'],
    }
  )
  deepEqualIgnoreOrder(
    t,
    await client.get({
      $alias: 'nicer_match',
      id: true,
      aliases: true,
    }),
    {
      id: match1,
      aliases: ['nice_match', 'nicer_match'],
    }
  )

  await client.set({
    $id: match1,
    aliases: { $delete: true },
  })

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $id: match1,
      id: true,
      aliases: true,
    }),
    {
      id: match1,
    }
  )
})

test('alias and merge = false', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    type: 'match',
    title: { en: 'yesh' },
    description: { en: 'lol' },
    aliases: { $add: ['nice_match'] },
  })
  const match2 = await client.set({
    type: 'match',
    title: { en: 'noh' },
    aliases: { $add: ['nicer_match'] },
  })

  await client.set({
    $id: match1,
    $merge: false,
    title: { en: 'lol' },
    //aliases: { $delete: true },
    //aliases: [],
  })

  deepEqualIgnoreOrder(
    t,
    // await client.redis.hgetall('___selva_aliases')
    (await client.command('lsaliases'))[0].sort(),
    ['nice_match', match1, 'nicer_match', match2]
  )
  const res1 = (await client.command('object.get', ['', match1]))[0]
  console.dir({ res1 }, { depth: 6 })
  deepEqualIgnoreOrder(t, res1, [
    'aliases',
    ['nice_match'],
    'createdAt',
    res1[3],
    'id',
    match1,
    'title',
    ['en', 'lol'],
    'type',
    'match',
    // 'updatedAt', // hmm?
    // res1[11],
  ])
})

test('ways to clear aliases', async (t) => {
  const { client } = t.context
  const match1 = await client.set({
    type: 'match',
    title: { en: 'yesh' },
    description: { en: 'lol' },
    aliases: { $add: ['nice_match'] },
  })
  const match2 = await client.set({
    type: 'match',
    title: { en: 'noh' },
    aliases: { $add: ['nicer_match'] },
  })

  await client.set({
    $id: match1,
    aliases: { $delete: true },
  })
  await client.set({
    $id: match2,
    aliases: [],
  })

  t.deepEqual((await client.command('lsaliases'))[0], [])
})

test('set with $alias', async (t) => {
  const { client } = t.context
  await client.updateSchema({
    language: 'en',
    types: {
      match: {
        prefix: 'ma',
        fields: {
          title: { type: 'text' },
        },
      },
    },
  })

  await client.set({
    $id: 'ma1',
    aliases: { $add: 'thingy' },
  })

  const x = await client.set({
    $alias: 'thingy',
    title: 'yesh',
    $language: 'en',
  })

  deepEqualIgnoreOrder(t, x, 'ma1')

  deepEqualIgnoreOrder(
    t,
    await client.get({
      $language: 'en',
      $alias: 'thingy',
      title: true,
    }),
    {
      title: 'yesh',
    }
  )
})
