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
    languages: ['en'],
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

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
})

// TODO: parents: { $add } not working
test.serial.skip('get nested results', async (t) => {
  const matches: any = []
  const teams: any = []

  for (let i = 0; i < 100; i++) {
    teams.push({
      $id: await client.id({ type: 'team' }),
      name: 'team ' + i,
      type: 'team',
    })
  }

  await Promise.all(teams.map((t) => client.set(t)))

  const league1Id = await client.set({
    type: 'league',
    name: 'league 1',
    // children: matches,
  })

  for (let i = 0; i < 10; i++) {
    matches.push({
      name: 'match ' + i,
      type: 'match',
      value: i,
      parents: {
        $add: [
          teams[~~(Math.random() * teams.length)].$id,
          teams[~~(Math.random() * teams.length)].$id,
          league1Id,
        ],
      },
      status: i < 5 ? 100 : 300,
    })
  }

  const result = await client.get({
    $includeMeta: true,
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

// TODO: $find.$find
test.serial.skip('get descendants of each child', async (t) => {
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
            $value: teams.map((id) => id),
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
  t.deepEqualIgnoreOrder(res?.matches, [
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

// TODO: $find.$find
test.serial.skip('get nested results with $all', async (t) => {
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

  await Promise.all(teams.map((t) => client.set(t)))

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

// TODO: $find.$find
test.serial.skip('get nested results as ids', async (t) => {
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

  await Promise.all(teams.map((t) => client.set(t)))

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
  t.is(result.items[0].parents.length, 2, 'has teams')
})

// TODO: $find.$find
test.serial.skip('get nested results without find', async (t) => {
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

  await Promise.all(teams.map((t) => client.set(t)))

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

  const child = result.children.find((c) => c.children.length)

  t.is(child.children.length, 10, 'has teams')
})

test.serial('nested refs', async (t) => {
  for (let i = 0; i < 3; i++) {
    const docs = await client.set({
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
