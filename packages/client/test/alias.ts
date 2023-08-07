import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
const port = 8081
test.beforeEach(async (t) => {
  console.log('origin')
  srv = await startOrigin({
    port,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en'],
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
          dingdongs: { type: 'array', values: { type: 'string' } },
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

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(500)
})

test.serial('get non-existing by $alias', async (t) => {
  t.deepEqualIgnoreOrder(
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

test.serial('set alias and get by $alias', async (t) => {
  const match1 = await client.set({
    aliases: ['nice_match'],
    type: 'match',
    title: { en: 'yesh' },
  })

  t.deepEqualIgnoreOrder(
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

  t.deepEqualIgnoreOrder(
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

  t.deepEqualIgnoreOrder(
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

  t.deepEqualIgnoreOrder(
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

  t.deepEqualIgnoreOrder(
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

test.serial('set new entry with alias', async (t) => {
  const match1 = await client.set({
    $alias: 'nice_match',
    type: 'match',
    title: { en: 'yesh' },
  })

  t.deepEqualIgnoreOrder(
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

test.serial('set existing entry with alias', async (t) => {
  const match1 = await client.set({
    $alias: 'nice_match',
    type: 'match',
    title: { en: 'yesh' },
  })

  t.deepEqualIgnoreOrder(
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

  t.deepEqualIgnoreOrder(
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

  t.deepEqualIgnoreOrder(
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

test.serial('set and get by $alias as id', async (t) => {
  const match1 = await client.set({
    type: 'match',
    title: { en: 'yesh' },
  })

  t.deepEqualIgnoreOrder(
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

test.serial('set parent by alias', async (t) => {
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

  t.deepEqualIgnoreOrder(stub.parents, undefined)

  t.deepEqualIgnoreOrder(
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

test.serial('set parent by alias 2', async (t) => {
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

  t.deepEqualIgnoreOrder(result2.items, [{ id: match1 }])
})

test.serial('delete all aliases of a node', async (t) => {
  const match1 = await client.set({
    type: 'match',
    title: { en: 'yesh' },
    aliases: { $add: ['nice_match', 'nicer_match'] },
  })

  t.deepEqualIgnoreOrder(
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
  t.deepEqualIgnoreOrder(
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

  t.deepEqualIgnoreOrder(
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

// TODO: waiting for $merge: false
test.serial.skip('alias and merge = false', async (t) => {
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

  t.deepEqual(
    // await client.redis.hgetall('___selva_aliases')
    (await client.command('lsaliases'))[0].sort(),
    {
      nice_match: match1,
      nicer_match: match2,
    }
  )
  // const res1 = await client.redis.selva_object_get('', match1)
  // t.deepEqual(res1, [
  //   'aliases',
  //   ['nice_match'],
  //   'createdAt',
  //   res1[3],
  //   'id',
  //   match1,
  //   'title',
  //   ['en', 'lol'],
  //   'type',
  //   'match',
  //   'updatedAt',
  //   res1[11],
  // ])
})

// TODO: lsaliases returns old aliases? (Olli)
test.serial.skip('ways to clear aliases', async (t) => {
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

// TODO: waiting for observe()
test.serial.skip('set alias, get it, remove it, get it again', async (t) => {
  const al = 'mybeautifulaliasmyesh'

  const custom1 = await client.set({
    type: 'custom',
    aliases: [al],
    value: 0,
  })

  const data = await client.get({
    $alias: al,
    id: true,
    value: true,
  })

  console.log('data', data)

  t.deepEqualIgnoreOrder(data, {
    id: custom1,
    value: 0,
  })

  let cnt = 0

  // client
  //   .observe({
  //     $alias: al,
  //     id: true,
  //     value: true,
  //     aliases: true,
  //   })
  //   .subscribe((data, checksum) => {
  //     console.log(data, checksum)
  //     cnt++
  //   })

  await wait(3000)

  await client.set({
    $id: custom1,
    value: 1,
  })

  await wait(250)

  await client.set({
    $id: custom1,
    aliases: { $delete: [al] },
  })

  await wait(3000)

  t.is(cnt, 3) // initial + change value + remove alias
})
