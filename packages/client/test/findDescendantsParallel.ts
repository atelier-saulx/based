import anyTest, { TestFn } from 'ava'
import { BasedDbClient } from '../src/index.js'
import { startOrigin, SelvaServer } from '@based/db-server'
import { wait } from '@saulx/utils'
import './assertions/index.js'
import getPort from 'get-port'

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
      club: {
        prefix: 'cl',
        fields: {
          name: { type: 'string' },
        },
      },
      team: {
        prefix: 'te',
        fields: {
          name: { type: 'string' },
        },
      },
      sport: {
        prefix: 'sp',
        fields: {
          rando: { type: 'string' },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          name: { type: 'string' },
          flupriflu: { type: 'string' },
          date: { type: 'number' },
          // need to warn if you change this!!!
          value: { type: 'number' },
          status: { type: 'number' },
        },
      },
      video: {
        prefix: 'vi',
        fields: {
          name: { type: 'string' },
          title: { type: 'text' },
          date: { type: 'number' },
          // making it different here should tell you something or at least take it over
          value: { type: 'number' },
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

test('parallel find - descendants', async (t) => {
  const { client } = t.context

  const team1 = await t.context.client.set({ type: 'team', name: 'team1' })

  const amount = 50000
  const vids = 100
  const genMatches = (s = 0) => {
    const ch: any = []
    for (let i = s; i < s + amount; i++) {
      if (i < 1000) {
        ch.push({
          type: 'match',
          flupriflu: 'true',
          name: 'match' + i,
          status: i === 0 ? 2 : i > 1000 ? 100 : 300,
          parents: { $add: team1 },
        })
      } else {
        ch.push({
          type: 'match',
          name: 'match' + i,
          status: 100,
        })
      }
    }
    return ch
  }

  const genVideos = () => {
    const ch: any = []
    for (let i = 0; i < vids; i++) {
      ch.push({
        type: 'video',
        name: 'video',
        title: { en: 'flap' },
        date: Date.now() + i + (i > 5 ? 1000000 : -100000),
        value: i,
      })
    }
    return ch
  }

  let d = Date.now()
  const ids = await Promise.all([
    t.context.client.set({
      type: 'club',
      name: 'club 1',
      children: [
        {
          $id: team1,
          name: 'team 1',
          children: {
            $add: genVideos(),
          },
        },
      ],
    }),
    t.context.client.set({
      type: 'league',
      name: 'league 1',
      // @ts-ignore
      children: genMatches(),
    }),
    t.context.client.set({
      type: 'league',
      name: 'league 2',
      // @ts-ignore
      children: genMatches(amount),
    }),
  ])

  console.info(
    `Set ${Math.floor((amount * 2 + vids) / 100) / 10}k nested`,
    Date.now() - d,
    'ms'
  )

  await wait(600)
  t.true(ids[0].slice(0, 2) === 'cl' && ids[1].slice(0, 2) === 'le')

  await wait(2e3)

  // // extra option in find is index or auto from fields
  const bq = {
    items: {
      name: true,
      value: true,
      status: true,
      date: true,
      id: true,
      type: true,
      $list: {
        $sort: { $field: 'status', $order: 'desc' },
        $limit: 1000,
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $operator: '=',
              $field: 'type',
              $value: 'match',
              $and: {
                $operator: '=',
                $field: 'status',
                $value: [300, 2],
              },
              $or: {
                $operator: '=',
                $field: 'name',
                $value: 'league 1',
                $or: {
                  $operator: '>',
                  $field: 'value',
                  $value: 4,
                  $and: {
                    $operator: '>',
                    $field: 'value',
                    $value: 6,
                    $and: {
                      $operator: '<',
                      $field: 'value',
                      $value: 8,
                      $and: {
                        $operator: '>',
                        $field: 'date',
                        $value: 'now',
                      },
                    },
                  },
                },
              },
            },
            {
              $operator: '!=',
              $field: 'name',
              $value: ['match1', 'match2', 'match3'],
            },
          ],
        },
      },
    },
  }
  const qs = Array.from({ length: 16 }, (_v, i) => {
    const o: typeof bq = JSON.parse(JSON.stringify(bq))
        // Ensure that every query looks a bit different to avoid the simplest forms of dedup
        o.items.date = !!(i & 0x01)
        o.items.id = !!(i & 0x02)
        o.items.name = !!(i & 0x04)
        o.items.status = !!(i && 0x08)
        o.items.value = !!(i && 0x10)
    return o
  });

  d = Date.now()
  const res = await Promise.all(qs.map((q) => client.get(q)))
  console.info('Executing query', Date.now() - d, 'ms')

  for (const { items } of res) {
    t.deepEqual(items.length, 1000)
  }
})
