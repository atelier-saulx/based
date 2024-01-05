import { basicTest } from '../assertions/index.js'
import { wait } from '@saulx/utils'
import { subscribe } from '@based/db-subs'

const test = basicTest({
  language: 'en',
  types: {
    match: {
      prefix: 'ma',
      fields: {
        title: { type: 'text' },
        name: { type: 'string' },
        value: { type: 'number' },
        status: { type: 'number' },
        date: { type: 'number' },
      },
    },
  },
})

test('subscription list', async (t) => {
  const client = t.context.client

  const matches: any[] = []

  await wait(500)

  for (let i = 0; i < 10; i++) {
    matches.push({
      $id: await client.id({ type: 'match' }),
      name: 'match ' + i,
      type: 'match',
      value: i,
      status: i < 5 ? 100 : 300,
    })
  }

  await Promise.all(matches.map((v) => client.set(v)))

  await wait(500)

  const obs = {
    children: {
      name: true,
      id: true,
      $list: {},
    },
  }
  let cnt = 0
  subscribe(client, obs, (_d: any) => {
    cnt++
  })

  await wait(1000)
  t.is(cnt, 1)

  client.set({
    $id: matches[0].$id,
    name: 'FLURP!',
  })

  await wait(1000)
  t.is(cnt, 2)

  const obs2 = {
    $language: 'en', // need this in my meta query
    title: true,
    children: {
      name: true,
      title: true,
      type: true,
      $list: {},
    },
  }

  const obs3 = {
    $language: 'en', // need this in my meta query, also need to use schema for this (adding lang field to text fields)
    title: true,
    items: {
      name: true,
      title: true,
      type: true,
      $list: {
        $find: {
          $traverse: 'children',
        },
      },
    },
  }

  let cnt2 = 0
  let cnt3 = 0
  subscribe(client, obs2, (_d: any) => {
    cnt2++
  })

  subscribe(client, obs3, (_d: any) => {
    cnt3++
  })

  await wait(2000)

  client.set({
    $id: matches[0].$id,
    title: { en: 'Flapdrol' },
  })

  await wait(2000)
  t.is(cnt3, 2)
  t.is(cnt2, 2)
})
