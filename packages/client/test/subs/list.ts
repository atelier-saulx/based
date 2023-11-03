import anyTest, { ExecutionContext, TestInterface } from 'ava'
import { wait } from '@saulx/utils'
import { TestCtx, observe, startSubs } from '../assertions'
import { BasedSchemaPartial } from '@based/schema'

const test = anyTest as TestInterface<TestCtx>

const schema: BasedSchemaPartial = {
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
}

test.serial('subscription list', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient

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
  observe(t, obs, (d) => {
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
  observe(t, obs2, (d) => {
    cnt2++
  })

  observe(t, obs3, (d) => {
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
