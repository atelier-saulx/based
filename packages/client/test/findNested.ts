import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
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
      league: {
        prefix: 'le',
        fields: {
          name: { type: 'string' },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          value: { type: 'number' },
          status: { type: 'number' },
        },
      },
      thing: {
        prefix: 'th',
        fields: {
          docs: { type: 'references' },
        },
      },
      file: {
        prefix: 'tx',
        fields: {
          name: { type: 'string' },
          mirrors: { type: 'references' },
        },
      },
      mirror: {
        prefix: 'sp',
        fields: {
          url: { type: 'string' },
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

test('get nested results', async (t) => {
  const { client } = t.context
  const matches: any = []
  const teams: any = []

  for (let i = 0; i < 100; i++) {
    teams.push({
      $id: await client.id({ type: 'team' }),
      name: 'team ' + i,
      type: 'team',
    })
  }

  await Promise.all(teams.map((t: any) => client.set(t)))

  for (let i = 0; i < 10; i++) {
    matches.push({
      name: 'match ' + i,
      type: 'match',
      value: i,
      parents: {
        $add: [
          teams[~~(Math.random() * teams.length)].$id,
          teams[~~(Math.random() * teams.length)].$id,
        ],
      },
      status: i < 5 ? 100 : 300,
    })
  }

  await client.set({
    type: 'league',
    name: 'league 1',
    children: matches,
  })

  const result = await client.get({
    items: {
      name: true,
      id: true,
      teams: {
        id: true,
        name: true,
        flurpy: true,
        $list: {
          $find: {
            $traverse: 'ancestors',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'team',
              },
              {
                $field: 'value',
                $operator: '!=',
                $value: 2,
              },
            ],
          },
        },
      },
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'match',
            },
          ],
        },
      },
    },
  })

  t.is(result.items.length, 10, 'items length')
  t.is(result.items[0].teams.length, 2, 'has teams')
})

test('get descendants of each child', async (t) => {
  const { client } = t.context
  const teams: any = []

  for (let i = 0; i < 3; i++) {
    teams.push(
      await client.set({
        $id: await client.id({ type: 'team' }),
        name: 'team ' + i,
        type: 'team',
        children: [
          {
            type: 'thing',
          },
        ],
      })
    )
  }

  for (let i = 0; i < 5; i++) {
    await client.set({
      name: 'match ' + i,
      type: 'match',
      value: i,
      parents: [teams[i % teams.length], teams[(i + 1) % teams.length]],
    })
  }

  const res = await client.get({
    matches: {
      name: true,
      $list: {
        $find: {
          $traverse: 'children',
          $filter: {
            $operator: '=',
            $field: 'id',
            $value: teams.map((id: any) => id),
          },
          $find: {
            $traverse: 'descendants',
            $filter: [
              {
                $operator: '=',
                $field: 'type',
                $value: 'match',
              },
            ],
          },
        },
      },
    },
  })
  console.dir({ res }, { depth: 6 })
  deepEqualIgnoreOrder(t, res?.matches, [
    { name: 'match 0' },
    { name: 'match 2' },
    { name: 'match 3' },
    { name: 'match 4' },
    { name: 'match 1' },
    { name: 'match 0' },
    { name: 'match 3' },
    { name: 'match 4' },
    { name: 'match 1' },
    { name: 'match 2' },
  ])
})

test('get nested results with $all', async (t) => {
  const { client } = t.context
  const matches: any = []
  const teams: any = []

  for (let i = 0; i < 100; i++) {
    teams.push({
      $id: await client.id({ type: 'team' }),
      name: 'team ' + i,
      type: 'team',
    })
  }

  for (let i = 0; i < 10; i++) {
    matches.push({
      name: 'match ' + i,
      type: 'match',
      value: i,
      parents: {
        $add: [
          teams[~~(Math.random() * teams.length)].$id,
          teams[~~(Math.random() * teams.length)].$id,
        ],
      },
      status: i < 5 ? 100 : 300,
    })
  }

  await Promise.all(teams.map((t: any) => client.set(t)))

  await client.set({
    type: 'league',
    name: 'league 1',
    children: matches,
  })

  let result = await client.get({
    items: {
      $all: true,
      teams: {
        $all: true,
        $list: {
          $find: {
            $traverse: 'ancestors',
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'team',
              },
              {
                $field: 'value',
                $operator: '!=',
                $value: 2,
              },
            ],
          },
        },
      },
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'match',
            },
          ],
        },
      },
    },
  })

  t.is(result.items.length, 10, 'items length')
  t.is(result.items[0].teams.length, 2, 'has teams')

  result = await client.get({
    items: {
      $all: true,
      status: false,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'match',
            },
          ],
        },
      },
    },
  })

  t.is(result.items.length, 10, 'items length')
  t.assert(
    (<any[]>result.items).every((r) => {
      return typeof r.status === 'undefined'
    })
  )
})

test('get nested results as ids', async (t) => {
  const { client } = t.context
  const matches: any = []
  const teams: any = []

  for (let i = 0; i < 100; i++) {
    teams.push({
      $id: await client.id({ type: 'team' }),
      name: 'team ' + i,
      type: 'team',
    })
  }

  for (let i = 0; i < 10; i++) {
    matches.push({
      name: 'match ' + i,
      type: 'match',
      value: i,
      parents: {
        $add: [
          teams[~~(Math.random() * teams.length)].$id,
          teams[~~(Math.random() * teams.length)].$id,
        ],
      },
      status: i < 5 ? 100 : 300,
    })
  }

  await Promise.all(teams.map((t: any) => client.set(t)))

  await client.set({
    type: 'league',
    name: 'league 1',
    children: matches,
  })

  const result = await client.get({
    items: {
      name: true,
      parents: true,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'match',
            },
          ],
        },
      },
    },
  })

  t.is(result.items.length, 10, 'items length')
  t.is(result.items[0].parents.length, 3, 'has teams and league')
})

test('get nested results without find', async (t) => {
  const { client } = t.context
  const matches: any = []
  const teams: any = []

  for (let i = 0; i < 100; i++) {
    teams.push({
      $id: await client.id({ type: 'team' }),
      name: 'team ' + i,
      type: 'team',
    })
  }

  for (let i = 0; i < 10; i++) {
    matches.push({
      name: 'match ' + i,
      type: 'match',
      value: i,
      parents: {
        $add: [
          teams[~~(Math.random() * teams.length)].$id,
          teams[~~(Math.random() * teams.length)].$id,
        ],
      },
      status: i < 5 ? 100 : 300,
    })
  }

  await Promise.all(teams.map((t: any) => client.set(t)))

  await client.set({
    type: 'league',
    name: 'league 1',
    children: matches,
  })

  const result = await client.get({
    name: true,
    id: true,
    children: {
      id: true,
      name: true,
      children: {
        id: true,
        name: true,
        // $list: { $find: { $traverse: 'children' } }
        $list: true,
      },
      $list: true,
    },
  })

  const child = result.children.find((c: any) => c.children.length)

  t.is(child.children.length, 10, 'has teams')
})

test('nested refs', async (t) => {
  const { client } = t.context
  for (let i = 0; i < 3; i++) {
    await client.set({
      type: 'thing',
      docs: [...Array(2)].map((_, i) => ({
        type: 'file',
        name: `file${i}.txt`,
        mirrors: [
          {
            type: 'mirror',
            url: `http://localhost:3000/file${i}.txt`,
          },
          {
            type: 'mirror',
            url: `http://localhost:3001/file${i}.txt`,
          },
        ],
      })),
    })
  }

  const q = {
    thingies: {
      $id: 'root',
      id: true,
      name: true,
      docs: {
        $list: true,
        name: true,
        mirrors: {
          $list: true,
          url: true,
        },
      },
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: {
            $field: 'type',
            $operator: '=',
            $value: 'thing',
          },
        },
      },
    },
  }
  const res = await client.get(q)
  t.truthy(res.thingies['0'].docs[0].mirrors)
})
